-- ============================================================================
-- Migración 21: Permisos y Asignación de Roles para Funciones RPC
-- Incluye Endurecimiento de Seguridad para las 3 Funciones Públicas (Anon)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLA DE RATE LIMIT / ANTIABUSO (Para funciones públicas como create_app_order)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,       -- ej: 'order_phone_3001234567' o 'coupon_ip_...'
  action_type TEXT NOT NULL,      -- 'create_order', 'validate_coupon'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_rate_limits_lookup 
  ON public.app_rate_limits(identifier, action_type, created_at DESC);

COMMENT ON TABLE public.app_rate_limits IS 'Control antiabuso y rate limiting a nivel de base de datos para llamadas públicas anon';


-- ----------------------------------------------------------------------------
-- 1. FUNCIÓN PÚBLICA 1: is_store_currently_open
-- Endurecida: Retorna BOOLEAN, SET search_path fijo, validación estricta.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_store_currently_open(UUID);

CREATE OR REPLACE FUNCTION public.is_store_currently_open(
  p_store_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  -- 1. Validación estricta de input
  IF p_store_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Búsqueda de estado de tienda
  SELECT is_active 
  INTO v_is_active
  FROM stores 
  WHERE id = p_store_id;

  RETURN COALESCE(v_is_active, FALSE);
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. FUNCIÓN PÚBLICA 2: validate_coupon
-- Endurecida: Sanitización estricta, rate limit anti brute-force, search_path fijo
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.validate_coupon(TEXT, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code        TEXT,
  p_store_id    UUID DEFAULT NULL,
  p_order_total INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_code      TEXT;
  v_coupon          RECORD;
  v_discount_amount INTEGER := 0;
  v_attempts        INTEGER;
BEGIN
  -- 1. Validación estricta de inputs
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', FALSE, 'message', 'Código de cupón requerido');
  END IF;

  v_clean_code := upper(trim(p_code));

  IF length(v_clean_code) < 2 OR length(v_clean_code) > 30 THEN
    RETURN jsonb_build_object('valid', FALSE, 'message', 'Formato de cupón inválido');
  END IF;

  -- Solo caracteres alfanuméricos y guiones
  IF v_clean_code !~ '^[A-Z0-9_-]+$' THEN
    RETURN jsonb_build_object('valid', FALSE, 'message', 'Código contiene caracteres inválidos');
  END IF;

  IF p_order_total < 0 THEN
    p_order_total := 0;
  END IF;

  -- 2. Antiabuso / Rate Limit (Máximo 60 consultas por minuto para evitar fuerza bruta)
  SELECT count(*) INTO v_attempts
  FROM app_rate_limits
  WHERE identifier = 'coupon_' || v_clean_code
    AND action_type = 'validate_coupon'
    AND created_at > (now() - INTERVAL '1 minute');

  IF v_attempts > 60 THEN
    RETURN jsonb_build_object(
      'valid', FALSE,
      'message', 'Demasiados intentos. Por favor espera un momento.'
    );
  END IF;

  INSERT INTO app_rate_limits (identifier, action_type)
  VALUES ('coupon_' || v_clean_code, 'validate_coupon');

  -- 3. Buscar cupón activo
  SELECT * INTO v_coupon
  FROM coupons
  WHERE code = v_clean_code
    AND is_active = TRUE;

  IF v_coupon IS NULL THEN
    RETURN jsonb_build_object(
      'valid', FALSE,
      'message', 'El cupón no existe o ha expirado'
    );
  END IF;

  -- 4. Validar mínimo de compra
  IF v_coupon.min_order_total IS NOT NULL AND p_order_total < v_coupon.min_order_total THEN
    RETURN jsonb_build_object(
      'valid', FALSE,
      'min_required', v_coupon.min_order_total,
      'message', format('El monto mínimo para este cupón es de $%s', v_coupon.min_order_total)
    );
  END IF;

  -- 5. Calcular descuento
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount_amount := round((p_order_total * v_coupon.discount_value) / 100.0);
  ELSE
    v_discount_amount := v_coupon.discount_value;
  END IF;

  -- No puede descontar más del total del pedido
  IF v_discount_amount > p_order_total THEN
    v_discount_amount := p_order_total;
  END IF;

  RETURN jsonb_build_object(
    'valid', TRUE,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount_amount,
    'final_total', (p_order_total - v_discount_amount),
    'message', 'Cupón aplicado correctamente'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. FUNCIÓN PÚBLICA 3: create_app_order
-- Endurecida: Validación exhaustiva, recálculo de precios del servidor (anti-tampering),
-- rate-limit por teléfono/cliente, search_path fijo.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_app_order(UUID, UUID, JSONB, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_app_order(
  p_customer_id      UUID,
  p_store_id         UUID,
  p_items            JSONB,
  p_is_delivery      BOOLEAN,
  p_customer_name    TEXT,
  p_customer_phone   TEXT,
  p_customer_address TEXT,
  p_total            INTEGER,
  p_notes            TEXT DEFAULT NULL,
  p_payment_method   TEXT DEFAULT 'efectivo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id         UUID;
  v_ticket_number    INTEGER;
  v_calc_total       INTEGER := 0;
  v_item             JSONB;
  v_product          RECORD;
  v_clean_name       TEXT;
  v_clean_phone      TEXT;
  v_clean_address    TEXT;
  v_recent_orders    INTEGER;
BEGIN
  -- 1. Sanitización de textos
  v_clean_name := trim(p_customer_name);
  v_clean_phone := regexp_replace(COALESCE(p_customer_phone, ''), '[^0-9+]', '', 'g');
  v_clean_address := trim(COALESCE(p_customer_address, ''));

  -- 2. Validación estricta de inputs
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'ID de tienda es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'La tienda seleccionada no está disponible o está inactiva';
  END IF;

  IF v_clean_name IS NULL OR length(v_clean_name) < 2 OR length(v_clean_name) > 100 THEN
    RAISE EXCEPTION 'Nombre de cliente inválido (debe tener entre 2 y 100 caracteres)';
  END IF;

  IF length(v_clean_phone) < 7 OR length(v_clean_phone) > 15 THEN
    RAISE EXCEPTION 'Número de teléfono inválido';
  END IF;

  IF p_is_delivery AND (length(v_clean_address) < 5 OR length(v_clean_address) > 255) THEN
    RAISE EXCEPTION 'Dirección de entrega obligatoria para pedidos a domicilio';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe contener al menos un producto';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El pedido excede la cantidad máxima permitida de ítems por orden (máx 50)';
  END IF;

  -- 3. Antiabuso / Rate Limit (Máximo 4 pedidos por teléfono en los últimos 10 minutos)
  SELECT count(*) INTO v_recent_orders
  FROM orders
  WHERE delivery_phone = v_clean_phone
    AND created_at > (now() - INTERVAL '10 minutes');

  IF v_recent_orders >= 4 THEN
    RAISE EXCEPTION 'Has alcanzado el límite de pedidos recientes. Por favor comunícate directamente con la tienda.';
  END IF;

  -- 4. Validar productos, disponibilidad y recalcular total en servidor (Anti-Tampering)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'product_id') IS NULL THEN
      RAISE EXCEPTION 'Ítem con product_id inválido';
    END IF;

    SELECT * INTO v_product 
    FROM products 
    WHERE id = (v_item->>'product_id')::UUID;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'product_id';
    END IF;

    IF NOT v_product.available THEN
      RAISE EXCEPTION 'El producto "%" no se encuentra disponible actualmente', v_product.name;
    END IF;

    IF (v_item->>'quantity')::INTEGER < 1 OR (v_item->>'quantity')::INTEGER > 99 THEN
      RAISE EXCEPTION 'Cantidad inválida para: % (debe estar entre 1 y 99)', v_product.name;
    END IF;

    v_calc_total := v_calc_total + (v_product.price * (v_item->>'quantity')::INTEGER);
  END LOOP;

  -- 5. Crear orden
  INSERT INTO orders (
    store_id,
    user_id,
    status,
    total,
    total_amount,
    is_delivery,
    delivery_name,
    delivery_phone,
    delivery_address,
    notes,
    locator
  ) VALUES (
    p_store_id,
    p_customer_id,
    'pendiente',
    v_calc_total,
    v_calc_total,
    p_is_delivery,
    v_clean_name,
    v_clean_phone,
    v_clean_address,
    CASE WHEN p_notes IS NOT NULL THEN substring(trim(p_notes) from 1 for 500) ELSE NULL END,
    'APP-' || substring(md5(random()::text) from 1 for 6)
  )
  RETURNING id, ticket_number INTO v_order_id, v_ticket_number;

  -- 6. Insertar items del pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal,
      notes,
      customizations,
      extras
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      v_product.price,
      v_product.price * (v_item->>'quantity')::INTEGER,
      v_item->>'notes',
      v_item->'customizations',
      v_item->'extras'
    );
  END LOOP;

  -- Registrar rate limit hit
  INSERT INTO app_rate_limits (identifier, action_type)
  VALUES ('order_phone_' || v_clean_phone, 'create_order');

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', v_order_id,
    'ticket_number', v_ticket_number,
    'total', v_calc_total,
    'status', 'pendiente',
    'message', 'Pedido registrado correctamente'
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- ASIGNACIÓN DE PRIVILEGIOS DE EJECUCIÓN
-- ----------------------------------------------------------------------------

-- 1. Públicas (Anon, Authenticated, Service Role)
GRANT EXECUTE ON FUNCTION public.is_store_currently_open(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_app_order(uuid, uuid, jsonb, boolean, text, text, text, integer, text, text) TO anon, authenticated, service_role;

-- 2. Usuario Autenticado General (Authenticated, Service Role)
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_other_sessions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_my_notifications() TO authenticated, service_role;

-- 3. Operativas y POS (Authenticated, Service Role)
GRANT EXECUTE ON FUNCTION public.update_order(uuid, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_payment(uuid, payment_method, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_payment(uuid, payment_method, integer, integer, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_order_item_completed(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_stock_from_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_update_stock_on_entry() TO authenticated, service_role;

-- 4. Administrativas (Authenticated, Service Role)
GRANT EXECUTE ON FUNCTION public.generate_cash_closing(timestamp with time zone, timestamp with time zone, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_cash_closing(timestamp with time zone, timestamp with time zone, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reporteria_stats(timestamp with time zone, timestamp with time zone, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_user_allowed_stores(uuid, uuid[]) TO authenticated, service_role;
