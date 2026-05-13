-- ============================================================
-- SCRIPT 4: Actualizar RPCs para soportar multi-tienda
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================


-- ── 1. create_order: ahora recibe p_store_id ─────────────────
CREATE OR REPLACE FUNCTION create_order(
  p_locator  TEXT,
  p_items    JSONB,
  p_notes    TEXT DEFAULT NULL,
  p_store_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id      UUID;
  v_ticket_number INTEGER;
  v_total         INTEGER := 0;
  v_item          JSONB;
  v_product       RECORD;
  v_resolved_store UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mesero','caja') AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Sin permisos para crear pedidos';
  END IF;

  IF p_locator IS NULL OR trim(p_locator) = '' THEN
    RAISE EXCEPTION 'El localizador es obligatorio';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un producto';
  END IF;

  -- Resolver tienda: parámetro explícito > perfil del usuario > error
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT store_id FROM profiles WHERE id = auth.uid())
  );
  IF v_resolved_store IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar la tienda para este pedido';
  END IF;

  -- Validar que la tienda existe y está activa
  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = v_resolved_store AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Tienda no encontrada o inactiva';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'product_id';
    END IF;
    IF NOT v_product.available THEN
      RAISE EXCEPTION 'Producto no disponible: %', v_product.name;
    END IF;
    IF (v_item->>'quantity')::INTEGER < 1 THEN
      RAISE EXCEPTION 'Cantidad inválida para: %', v_product.name;
    END IF;
    v_total := v_total + (v_item->>'unit_price')::INTEGER * (v_item->>'quantity')::INTEGER;
  END LOOP;

  INSERT INTO orders (locator, status, total, notes, created_by, store_id)
  VALUES (trim(p_locator), 'pendiente', v_total, p_notes, auth.uid(), v_resolved_store)
  RETURNING id, ticket_number INTO v_order_id, v_ticket_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, notes)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::INTEGER,
      v_item->>'notes'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id',      v_order_id,
    'locator',       trim(p_locator),
    'total',         v_total,
    'status',        'pendiente',
    'ticket_number', v_ticket_number,
    'store_id',      v_resolved_store
  );
END;
$$;


-- ── 2. get_dashboard_stats: ahora recibe p_store_id ──────────
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_store_id UUID DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result        JSON;
  v_shift_start   TIMESTAMPTZ;
  v_resolved_store UUID;
BEGIN
  -- Resolver tienda
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

  -- Turno: desde las 4pm del día anterior (o de hoy si ya pasaron las 4pm)
  v_shift_start := date_trunc('day', now()) + INTERVAL '16 hours';
  IF now() < v_shift_start THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  SELECT json_build_object(
    'total_revenue',   COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    'active_orders',   COUNT(*) FILTER (WHERE status NOT IN ('entregado','cancelado')),
    'completed_today', COUNT(*) FILTER (WHERE status = 'entregado'),
    'cancelled_today', COUNT(*) FILTER (WHERE status = 'cancelado'),
    'avg_ticket',      COALESCE(
                         AVG(total) FILTER (WHERE status = 'entregado'),
                         0
                       ),
    'cash_total',      COALESCE((
                         SELECT SUM(CASE
                           WHEN p.method = 'efectivo' THEN p.amount_total
                           WHEN p.method = 'mixto' THEN p.amount_efectivo
                           ELSE 0 END)
                         FROM payments p
                         JOIN orders o ON o.id = p.order_id
                         WHERE o.created_at >= v_shift_start
                           AND o.status = 'entregado'
                           AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
                       ), 0),
    'card_total',      COALESCE((
                         SELECT SUM(CASE
                           WHEN p.method = 'tarjeta' THEN p.amount_total
                           WHEN p.method = 'mixto' THEN p.amount_tarjeta
                           ELSE 0 END)
                         FROM payments p
                         JOIN orders o ON o.id = p.order_id
                         WHERE o.created_at >= v_shift_start
                           AND o.status = 'entregado'
                           AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
                       ), 0),
    'nequi_total',     COALESCE((
                         SELECT SUM(CASE
                           WHEN p.method = 'nequi' THEN p.amount_total
                           WHEN p.method = 'mixto' THEN p.amount_nequi
                           ELSE 0 END)
                         FROM payments p
                         JOIN orders o ON o.id = p.order_id
                         WHERE o.created_at >= v_shift_start
                           AND o.status = 'entregado'
                           AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
                       ), 0)
  ) INTO v_result
  FROM orders
  WHERE created_at >= v_shift_start
    AND (v_resolved_store IS NULL OR store_id = v_resolved_store);

  RETURN v_result;
END;
$$;


-- ── 3. get_top_products: ahora recibe p_store_id ─────────────
CREATE OR REPLACE FUNCTION get_top_products(
  p_limit    INTEGER DEFAULT 6,
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE(product_name TEXT, category TEXT, quantity BIGINT, revenue BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift_start    TIMESTAMPTZ;
  v_resolved_store UUID;
BEGIN
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT prof.store_id FROM profiles prof WHERE prof.id = auth.uid())
  );

  v_shift_start := date_trunc('day', now()) + INTERVAL '16 hours';
  IF now() < v_shift_start THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  RETURN QUERY
  SELECT
    p.name                           AS product_name,
    COALESCE(c.name, 'Sin categoría') AS category,
    SUM(oi.quantity)                  AS quantity,
    SUM(oi.unit_price * oi.quantity)  AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE o.created_at >= v_shift_start
    AND o.status = 'entregado'
    AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
  GROUP BY p.name, c.name
  ORDER BY quantity DESC
  LIMIT COALESCE(p_limit, 6);
END;
$$;


-- ── 4. generate_cash_closing: ahora recibe p_store_id ────────
CREATE OR REPLACE FUNCTION generate_cash_closing(
  p_period_start TIMESTAMPTZ,
  p_period_end   TIMESTAMPTZ,
  p_notes        TEXT DEFAULT NULL,
  p_store_id     UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_closing_id    UUID;
  v_total_sales   INTEGER;
  v_total_orders  INTEGER;
  v_delivered     INTEGER;
  v_pending_cnt   INTEGER;
  v_pending_total INTEGER;
  v_cancelled_cnt INTEGER;
  v_cancelled_tot INTEGER;
  v_cash          INTEGER;
  v_card          INTEGER;
  v_nequi         INTEGER;
  v_user_role     user_role;
  v_resolved_store UUID;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_user_role NOT IN ('caja','admin') THEN
    RAISE EXCEPTION 'Solo caja o admin pueden generar cierres de caja';
  END IF;

  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

  SELECT
    COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'entregado'),
    COUNT(*) FILTER (WHERE status NOT IN ('entregado','cancelado')),
    COALESCE(SUM(total) FILTER (WHERE status NOT IN ('entregado','cancelado')), 0),
    COUNT(*) FILTER (WHERE status = 'cancelado'),
    COALESCE(SUM(total) FILTER (WHERE status = 'cancelado'), 0)
  INTO v_total_sales, v_total_orders, v_delivered,
       v_pending_cnt, v_pending_total, v_cancelled_cnt, v_cancelled_tot
  FROM orders
  WHERE created_at BETWEEN p_period_start AND p_period_end
    AND (v_resolved_store IS NULL OR store_id = v_resolved_store);

  SELECT
    COALESCE(SUM(CASE WHEN p.method = 'efectivo' THEN p.amount_total
                      WHEN p.method = 'mixto' THEN p.amount_efectivo ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.method = 'tarjeta' THEN p.amount_total
                      WHEN p.method = 'mixto' THEN p.amount_tarjeta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.method = 'nequi' THEN p.amount_total
                      WHEN p.method = 'mixto' THEN p.amount_nequi ELSE 0 END), 0)
  INTO v_cash, v_card, v_nequi
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  WHERE o.created_at BETWEEN p_period_start AND p_period_end
    AND o.status = 'entregado'
    AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store);

  INSERT INTO cash_register_closings (
    closed_by, period_start, period_end, total_sales, total_orders,
    delivered_count, pending_count, pending_total,
    cancelled_count, cancelled_total, cash_total, card_total, nequi_total,
    notes, store_id
  ) VALUES (
    auth.uid(), p_period_start, p_period_end, v_total_sales, v_total_orders,
    v_delivered, v_pending_cnt, v_pending_total,
    v_cancelled_cnt, v_cancelled_tot, v_cash, v_card, v_nequi,
    p_notes, v_resolved_store
  ) RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'closing_id',      v_closing_id,
    'total_sales',     v_total_sales,
    'total_orders',    v_total_orders,
    'delivered_count', v_delivered,
    'cash_total',      v_cash,
    'card_total',      v_card,
    'nequi_total',     v_nequi,
    'store_id',        v_resolved_store
  );
END;
$$;


-- ── 5. handle_new_user: ahora soporta store_id en metadata ───
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, store_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'mesero'
    ),
    (NEW.raw_user_meta_data->>'store_id')::UUID
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ── 6. update_user: ahora soporta p_store_id ─────────────────
CREATE OR REPLACE FUNCTION update_user(
  p_user_id   UUID,
  p_name      TEXT    DEFAULT NULL,
  p_email     TEXT    DEFAULT NULL,
  p_role      TEXT    DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_store_id  UUID    DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_role user_role;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede actualizar usuarios';
  END IF;

  UPDATE profiles SET
    name      = COALESCE(p_name, name),
    role      = COALESCE(p_role::user_role, role),
    is_active = COALESCE(p_is_active, is_active),
    store_id  = CASE
                  WHEN p_store_id IS NOT NULL THEN p_store_id
                  ELSE store_id
                END
  WHERE id = p_user_id;

  RETURN json_build_object('success', TRUE, 'user_id', p_user_id);
END;
$$;


-- ── 7. Verificar que los RPCs se actualizaron ────────────────
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN (
  'create_order', 'get_dashboard_stats', 'get_top_products',
  'generate_cash_closing', 'handle_new_user', 'update_user'
)
ORDER BY proname;
