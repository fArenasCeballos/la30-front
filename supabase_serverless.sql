-- ============================================================
-- LA 30 - PERROS Y HAMBURGUESAS
-- Script SQL completo SERVERLESS (sin backend)
-- Todo funciona directamente con Supabase: Auth, RPC, Triggers,
-- Realtime, Storage, RLS
-- ============================================================

-- ============================================================
-- 0. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "moddatetime";   -- Para auto-update de updated_at

-- ============================================================
-- 1. TIPOS ENUM
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'caja', 'mesero', 'cocina');

CREATE TYPE order_status AS ENUM (
  'pendiente',
  'confirmado',
  'en_preparacion',
  'listo',
  'entregado',
  'cancelado'
);

CREATE TYPE payment_method AS ENUM ('efectivo', 'tarjeta', 'nequi');
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning');

-- ============================================================
-- 2. TABLAS
-- ============================================================

-- -----------------------
-- 2.1 PERFILES (vinculado a Supabase Auth)
-- -----------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  role        user_role   NOT NULL DEFAULT 'mesero',
  avatar_url  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- -----------------------
-- 2.2 CATEGORÍAS (tabla dinámica)
-- -----------------------
CREATE TABLE categories (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT    NOT NULL UNIQUE,
  label       TEXT    NOT NULL,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------
-- 2.3 PRODUCTOS
-- -----------------------
CREATE TABLE products (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  price       INTEGER     NOT NULL CHECK (price >= 0),
  image_url   TEXT,
  available   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(available);

-- -----------------------
-- 2.4 OPCIONES DE PERSONALIZACIÓN
-- -----------------------
CREATE TABLE product_custom_options (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  option_key  TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, option_key)
);

-- -----------------------
-- 2.5 VALORES DE OPCIONES
-- -----------------------
CREATE TABLE product_custom_choices (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id   UUID    NOT NULL REFERENCES product_custom_options(id) ON DELETE CASCADE,
  value       TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(option_id, value)
);

-- -----------------------
-- 2.6 EXTRAS (adicionales con precio)
-- -----------------------
CREATE TABLE product_extras (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  extra_key       TEXT    NOT NULL,
  label           TEXT    NOT NULL,
  icon            TEXT,
  price_per_unit  INTEGER NOT NULL CHECK (price_per_unit >= 0),
  max_qty         INTEGER NOT NULL DEFAULT 1 CHECK (max_qty >= 1),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, extra_key)
);

-- -----------------------
-- 2.7 PEDIDOS
-- -----------------------
CREATE TABLE orders (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  locator     TEXT          NOT NULL,
  status      order_status  NOT NULL DEFAULT 'pendiente',
  total       INTEGER       NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes       TEXT,
  created_by  UUID          NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_locator ON orders(locator);
CREATE INDEX idx_orders_created_by ON orders(created_by);

-- -----------------------
-- 2.8 ITEMS DEL PEDIDO
-- -----------------------
CREATE TABLE order_items (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID    NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  INTEGER NOT NULL CHECK (unit_price >= 0),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- -----------------------
-- 2.9 PAGOS
-- -----------------------
CREATE TABLE payments (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method          payment_method  NOT NULL,
  amount_total    INTEGER         NOT NULL CHECK (amount_total >= 0),
  amount_received INTEGER         NOT NULL CHECK (amount_received >= 0),
  amount_change   INTEGER         NOT NULL DEFAULT 0 CHECK (amount_change >= 0),
  processed_by    UUID            NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- -----------------------
-- 2.10 NOTIFICACIONES
-- -----------------------
CREATE TABLE notifications (
  id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message     TEXT              NOT NULL,
  type        notification_type NOT NULL DEFAULT 'info',
  order_id    UUID              REFERENCES orders(id) ON DELETE SET NULL,
  read        BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- -----------------------
-- 2.11 AUDIT LOG DE ESTADOS
-- -----------------------
CREATE TABLE order_status_log (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status order_status,
  new_status      order_status  NOT NULL,
  changed_by      UUID          REFERENCES profiles(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_log_order ON order_status_log(order_id);
CREATE INDEX idx_status_log_created_at ON order_status_log(created_at DESC);

-- -----------------------
-- 2.12 CIERRE DE CAJA
-- -----------------------
CREATE TABLE cash_register_closings (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  closed_by         UUID        NOT NULL REFERENCES profiles(id),
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  total_sales       INTEGER     NOT NULL DEFAULT 0,
  total_orders      INTEGER     NOT NULL DEFAULT 0,
  delivered_count   INTEGER     NOT NULL DEFAULT 0,
  pending_count     INTEGER     NOT NULL DEFAULT 0,
  pending_total     INTEGER     NOT NULL DEFAULT 0,
  cancelled_count   INTEGER     NOT NULL DEFAULT 0,
  cancelled_total   INTEGER     NOT NULL DEFAULT 0,
  cash_total        INTEGER     NOT NULL DEFAULT 0,
  card_total        INTEGER     NOT NULL DEFAULT 0,
  nequi_total       INTEGER     NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

-- -----------------------------------------------------------
-- 3.1 Auto-update updated_at
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated   BEFORE UPDATE ON profiles   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated   BEFORE UPDATE ON products   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated     BEFORE UPDATE ON orders     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- 3.2 Crear perfil automáticamente al registrar usuario en Supabase Auth
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'mesero'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------------
-- 3.3 Recalcular total del pedido automáticamente
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  UPDATE orders
  SET total = (
    SELECT COALESCE(SUM(unit_price * quantity), 0)
    FROM order_items
    WHERE order_id = v_order_id
  )
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_recalculate_total_insert
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();

CREATE TRIGGER trg_recalculate_total_update
  AFTER UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();

CREATE TRIGGER trg_recalculate_total_delete
  AFTER DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();

-- -----------------------------------------------------------
-- 3.4 Audit log automático de cambios de estado
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_log (order_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_order_status_log
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- -----------------------------------------------------------
-- 3.5 Notificaciones automáticas por cambio de estado
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_message TEXT;
  v_type    notification_type;
  v_target_roles user_role[];
  v_user_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determinar mensaje y tipo según el nuevo estado
  CASE NEW.status
    WHEN 'confirmado' THEN
      v_message := '✅ Pedido ' || NEW.locator || ' confirmado por caja';
      v_type    := 'info';
      v_target_roles := ARRAY['cocina', 'admin']::user_role[];

    WHEN 'en_preparacion' THEN
      v_message := '👨‍🍳 Pedido ' || NEW.locator || ' en preparación';
      v_type    := 'info';
      v_target_roles := ARRAY['caja', 'admin']::user_role[];

    WHEN 'listo' THEN
      v_message := '🔔 Pedido ' || NEW.locator || ' ¡LISTO! Llamar cliente';
      v_type    := 'success';
      v_target_roles := ARRAY['caja', 'mesero', 'admin']::user_role[];

    WHEN 'entregado' THEN
      v_message := '💰 Pedido ' || NEW.locator || ' entregado y cobrado';
      v_type    := 'info';
      v_target_roles := ARRAY['admin']::user_role[];

    WHEN 'cancelado' THEN
      v_message := '❌ Pedido ' || NEW.locator || ' cancelado';
      v_type    := 'warning';
      v_target_roles := ARRAY['cocina', 'caja', 'admin']::user_role[];

    ELSE
      RETURN NEW;
  END CASE;

  -- Insertar notificación para cada usuario con los roles objetivo
  FOR v_user_id IN
    SELECT id FROM profiles
    WHERE role = ANY(v_target_roles) AND is_active = TRUE
  LOOP
    INSERT INTO notifications (user_id, message, type, order_id)
    VALUES (v_user_id, v_message, v_type, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();

-- -----------------------------------------------------------
-- 3.6 Notificación automática al crear nuevo pedido
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Notificar a caja y admin que hay un nuevo pedido
  FOR v_user_id IN
    SELECT id FROM profiles
    WHERE role IN ('caja', 'admin') AND is_active = TRUE
  LOOP
    INSERT INTO notifications (user_id, message, type, order_id)
    VALUES (
      v_user_id,
      '🆕 Nuevo pedido ' || NEW.locator || ' recibido en caja',
      'info',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_new_order();

-- ============================================================
-- 4. FUNCIONES RPC (lógica de negocio llamada desde el frontend)
-- ============================================================

-- -----------------------------------------------------------
-- 4.1 Obtener perfil del usuario actual (con rol)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  email       TEXT,
  role        user_role,
  avatar_url  TEXT,
  is_active   BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, email, role, avatar_url, is_active
  FROM profiles
  WHERE id = auth.uid();
$$;

-- -----------------------------------------------------------
-- 4.2 Crear pedido completo (order + items transaccional)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION create_order(
  p_locator   TEXT,
  p_items     JSONB,       -- [{"product_id":"uuid","quantity":2,"unit_price":12000,"notes":"Sin cebolla"}]
  p_notes     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id  UUID;
  v_total     INTEGER := 0;
  v_item      JSONB;
  v_product   RECORD;
BEGIN
  -- Validar que el usuario tiene el rol adecuado
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'mesero', 'caja')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para crear pedidos';
  END IF;

  -- Validar localizador
  IF p_locator IS NULL OR trim(p_locator) = '' THEN
    RAISE EXCEPTION 'El localizador es obligatorio';
  END IF;

  -- Validar que hay items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un item';
  END IF;

  -- Validar cada producto y calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'product_id';
    END IF;

    IF NOT v_product.available THEN
      RAISE EXCEPTION 'Producto no disponible: %', v_product.name;
    END IF;

    IF (v_item->>'quantity')::INTEGER < 1 THEN
      RAISE EXCEPTION 'Cantidad inválida para %', v_product.name;
    END IF;

    v_total := v_total + (v_item->>'unit_price')::INTEGER * (v_item->>'quantity')::INTEGER;
  END LOOP;

  -- Crear la orden
  INSERT INTO orders (locator, status, total, notes, created_by)
  VALUES (trim(p_locator), 'pendiente', v_total, p_notes, auth.uid())
  RETURNING id INTO v_order_id;

  -- Insertar items
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
    'order_id', v_order_id,
    'locator', trim(p_locator),
    'total', v_total,
    'status', 'pendiente'
  );
END;
$$;

-- -----------------------------------------------------------
-- 4.3 Actualizar estado del pedido (con validación de flujo)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id  UUID,
  p_status    order_status
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       RECORD;
  v_user_role   user_role;
  v_allowed     BOOLEAN := FALSE;
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Obtener orden actual
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Validar transiciones de estado permitidas por rol
  CASE p_status
    WHEN 'confirmado' THEN
      -- Solo caja/admin pueden confirmar, solo desde pendiente
      v_allowed := v_user_role IN ('caja', 'admin') AND v_order.status = 'pendiente';

    WHEN 'en_preparacion' THEN
      -- Caja/admin confirman pago y envían a cocina, o cocina empieza a preparar
      v_allowed := (v_user_role IN ('caja', 'admin') AND v_order.status = 'confirmado')
                OR (v_user_role IN ('cocina', 'admin') AND v_order.status = 'confirmado');

    WHEN 'listo' THEN
      -- Solo cocina/admin pueden marcar listo, desde en_preparacion
      v_allowed := v_user_role IN ('cocina', 'admin') AND v_order.status = 'en_preparacion';

    WHEN 'entregado' THEN
      -- Solo caja/admin pueden entregar, desde listo
      v_allowed := v_user_role IN ('caja', 'admin') AND v_order.status = 'listo';

    WHEN 'cancelado' THEN
      -- Caja/admin pueden cancelar desde cualquier estado excepto entregado/cancelado
      v_allowed := v_user_role IN ('caja', 'admin')
                AND v_order.status NOT IN ('entregado', 'cancelado');

    ELSE
      RAISE EXCEPTION 'Estado inválido: %', p_status;
  END CASE;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transición no permitida: % → % (rol: %)', v_order.status, p_status, v_user_role;
  END IF;

  -- Actualizar estado
  UPDATE orders SET status = p_status WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'locator', v_order.locator,
    'previous_status', v_order.status,
    'new_status', p_status
  );
END;
$$;

-- -----------------------------------------------------------
-- 4.4 Procesar pago
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION process_payment(
  p_order_id        UUID,
  p_method          payment_method,
  p_amount_received INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order      RECORD;
  v_payment_id UUID;
  v_change     INTEGER;
  v_user_role  user_role;
BEGIN
  -- Validar rol (solo caja/admin)
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('caja', 'admin') THEN
    RAISE EXCEPTION 'Solo caja o admin pueden procesar pagos';
  END IF;

  -- Obtener orden
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF v_order.status != 'confirmado' THEN
    RAISE EXCEPTION 'El pedido debe estar confirmado para cobrar (estado actual: %)', v_order.status;
  END IF;

  -- Validar monto
  IF p_amount_received < v_order.total THEN
    RAISE EXCEPTION 'Monto insuficiente: recibido $% pero el total es $%', p_amount_received, v_order.total;
  END IF;

  v_change := p_amount_received - v_order.total;

  -- Registrar pago
  INSERT INTO payments (order_id, method, amount_total, amount_received, amount_change, processed_by)
  VALUES (p_order_id, p_method, v_order.total, p_amount_received, v_change, auth.uid())
  RETURNING id INTO v_payment_id;

  -- Enviar a cocina automáticamente después del pago
  UPDATE orders SET status = 'en_preparacion' WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id', p_order_id,
    'locator', v_order.locator,
    'method', p_method,
    'total', v_order.total,
    'received', p_amount_received,
    'change', v_change,
    'new_status', 'en_preparacion'
  );
END;
$$;

-- -----------------------------------------------------------
-- 4.5 Marcar todas las notificaciones como leídas
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_notifications_read()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = auth.uid() AND read = FALSE;
$$;

-- -----------------------------------------------------------
-- 4.6 Limpiar notificaciones del usuario actual
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION clear_my_notifications()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM notifications WHERE user_id = auth.uid();
$$;

-- -----------------------------------------------------------
-- 4.7 Obtener conteo de notificaciones no leídas
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM notifications
  WHERE user_id = auth.uid() AND read = FALSE;
$$;

-- -----------------------------------------------------------
-- 4.8 Generar cierre de caja para un rango de fechas
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_cash_closing(
  p_period_start  TIMESTAMPTZ,
  p_period_end    TIMESTAMPTZ,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closing_id      UUID;
  v_total_sales     INTEGER;
  v_total_orders    INTEGER;
  v_delivered_count INTEGER;
  v_pending_count   INTEGER;
  v_pending_total   INTEGER;
  v_cancelled_count INTEGER;
  v_cancelled_total INTEGER;
  v_cash_total      INTEGER;
  v_card_total      INTEGER;
  v_nequi_total     INTEGER;
  v_user_role       user_role;
BEGIN
  -- Solo caja/admin
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();
  IF v_user_role NOT IN ('caja', 'admin') THEN
    RAISE EXCEPTION 'Solo caja o admin pueden generar cierres de caja';
  END IF;

  -- Calcular estadísticas del período
  SELECT
    COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'entregado'),
    COUNT(*) FILTER (WHERE status NOT IN ('entregado', 'cancelado')),
    COALESCE(SUM(total) FILTER (WHERE status NOT IN ('entregado', 'cancelado')), 0),
    COUNT(*) FILTER (WHERE status = 'cancelado'),
    COALESCE(SUM(total) FILTER (WHERE status = 'cancelado'), 0)
  INTO v_total_sales, v_total_orders, v_delivered_count,
       v_pending_count, v_pending_total, v_cancelled_count, v_cancelled_total
  FROM orders
  WHERE created_at BETWEEN p_period_start AND p_period_end;

  -- Pagos por método
  SELECT
    COALESCE(SUM(amount_total) FILTER (WHERE method = 'efectivo'), 0),
    COALESCE(SUM(amount_total) FILTER (WHERE method = 'tarjeta'), 0),
    COALESCE(SUM(amount_total) FILTER (WHERE method = 'nequi'), 0)
  INTO v_cash_total, v_card_total, v_nequi_total
  FROM payments
  WHERE created_at BETWEEN p_period_start AND p_period_end;

  -- Insertar cierre
  INSERT INTO cash_register_closings (
    closed_by, period_start, period_end,
    total_sales, total_orders, delivered_count,
    pending_count, pending_total,
    cancelled_count, cancelled_total,
    cash_total, card_total, nequi_total, notes
  ) VALUES (
    auth.uid(), p_period_start, p_period_end,
    v_total_sales, v_total_orders, v_delivered_count,
    v_pending_count, v_pending_total,
    v_cancelled_count, v_cancelled_total,
    v_cash_total, v_card_total, v_nequi_total, p_notes
  ) RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'closing_id', v_closing_id,
    'total_sales', v_total_sales,
    'total_orders', v_total_orders,
    'delivered', v_delivered_count,
    'pending', v_pending_count,
    'cancelled', v_cancelled_count,
    'cash', v_cash_total,
    'card', v_card_total,
    'nequi', v_nequi_total
  );
END;
$$;

-- -----------------------------------------------------------
-- 4.9 Gestión de usuarios (solo admin)
-- -----------------------------------------------------------

-- Obtener todos los usuarios
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  email       TEXT,
  role        user_role,
  avatar_url  TEXT,
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede listar usuarios';
  END IF;

  RETURN QUERY SELECT p.id, p.name, p.email, p.role, p.avatar_url, p.is_active, p.created_at
  FROM profiles p
  ORDER BY p.created_at;
END;
$$;

-- Actualizar rol/datos de un usuario
CREATE OR REPLACE FUNCTION update_user(
  p_user_id   UUID,
  p_name      TEXT DEFAULT NULL,
  p_email     TEXT DEFAULT NULL,
  p_role      user_role DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede editar usuarios';
  END IF;

  UPDATE profiles SET
    name      = COALESCE(p_name, name),
    email     = COALESCE(p_email, email),
    role      = COALESCE(p_role, role),
    is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'updated', TRUE);
END;
$$;

-- -----------------------------------------------------------
-- 4.10 Toggle disponibilidad de producto
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION toggle_product_availability(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_available BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede modificar productos';
  END IF;

  UPDATE products
  SET available = NOT available
  WHERE id = p_product_id
  RETURNING available INTO v_new_available;

  IF v_new_available IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  RETURN jsonb_build_object('product_id', p_product_id, 'available', v_new_available);
END;
$$;

-- -----------------------------------------------------------
-- 4.11 Estadísticas del dashboard
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start   TIMESTAMPTZ;
  v_total_revenue INTEGER;
  v_active_orders INTEGER;
  v_completed     INTEGER;
  v_cancelled     INTEGER;
  v_avg_ticket    INTEGER;
BEGIN
  v_today_start := DATE_TRUNC('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota';

  SELECT
    COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    COUNT(*) FILTER (WHERE status IN ('pendiente', 'confirmado', 'en_preparacion', 'listo')),
    COUNT(*) FILTER (WHERE status = 'entregado'),
    COUNT(*) FILTER (WHERE status = 'cancelado')
  INTO v_total_revenue, v_active_orders, v_completed, v_cancelled
  FROM orders
  WHERE created_at >= v_today_start;

  v_avg_ticket := CASE WHEN v_completed > 0 THEN v_total_revenue / v_completed ELSE 0 END;

  RETURN jsonb_build_object(
    'total_revenue', v_total_revenue,
    'active_orders', v_active_orders,
    'completed_today', v_completed,
    'cancelled_today', v_cancelled,
    'avg_ticket', v_avg_ticket
  );
END;
$$;

-- -----------------------------------------------------------
-- 4.12 Productos más vendidos (para Dashboard)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_top_products(p_limit INTEGER DEFAULT 6)
RETURNS TABLE (
  product_name  TEXT,
  category      TEXT,
  quantity      BIGINT,
  revenue       BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.name,
    c.label,
    SUM(oi.quantity)                  AS quantity,
    SUM(oi.unit_price * oi.quantity)  AS revenue
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN categories c ON c.id = p.category_id
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status != 'cancelado'
  GROUP BY p.name, c.label
  ORDER BY quantity DESC
  LIMIT p_limit;
$$;

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_custom_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_custom_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_closings ENABLE ROW LEVEL SECURITY;

-- Helper: función para obtener el rol del usuario actual (caché)
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ----- PROFILES -----
CREATE POLICY "profiles: ver todos (autenticado)"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles: editar propio"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: admin gestiona todo"
  ON profiles FOR ALL TO authenticated
  USING (auth_user_role() = 'admin');

-- ----- CATEGORIES -----
CREATE POLICY "categories: ver todos"
  ON categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories: admin crea"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "categories: admin edita"
  ON categories FOR UPDATE TO authenticated
  USING (auth_user_role() = 'admin');

CREATE POLICY "categories: admin elimina"
  ON categories FOR DELETE TO authenticated
  USING (auth_user_role() = 'admin');

-- ----- PRODUCTS -----
CREATE POLICY "products: ver todos"
  ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "products: admin crea"
  ON products FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY "products: admin edita"
  ON products FOR UPDATE TO authenticated
  USING (auth_user_role() = 'admin');

CREATE POLICY "products: admin elimina"
  ON products FOR DELETE TO authenticated
  USING (auth_user_role() = 'admin');

-- ----- CUSTOM OPTIONS, CHOICES, EXTRAS -----
CREATE POLICY "custom_options: ver" ON product_custom_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_options: admin" ON product_custom_options FOR ALL TO authenticated USING (auth_user_role() = 'admin');

CREATE POLICY "custom_choices: ver" ON product_custom_choices FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_choices: admin" ON product_custom_choices FOR ALL TO authenticated USING (auth_user_role() = 'admin');

CREATE POLICY "extras: ver" ON product_extras FOR SELECT TO authenticated USING (true);
CREATE POLICY "extras: admin" ON product_extras FOR ALL TO authenticated USING (auth_user_role() = 'admin');

-- ----- ORDERS -----
CREATE POLICY "orders: ver todos"
  ON orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "orders: crear (mesero/caja/admin)"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin', 'mesero', 'caja'));

CREATE POLICY "orders: actualizar (caja/cocina/admin)"
  ON orders FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('admin', 'caja', 'cocina'));

-- ----- ORDER ITEMS -----
CREATE POLICY "order_items: ver" ON order_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "order_items: crear"
  ON order_items FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin', 'mesero', 'caja'));

CREATE POLICY "order_items: editar"
  ON order_items FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('admin', 'caja'));

CREATE POLICY "order_items: eliminar"
  ON order_items FOR DELETE TO authenticated
  USING (auth_user_role() IN ('admin', 'caja'));

-- ----- PAYMENTS -----
CREATE POLICY "payments: ver" ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "payments: crear (caja/admin)"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin', 'caja'));

-- ----- NOTIFICATIONS -----
CREATE POLICY "notifications: ver propias"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: modificar propias"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: eliminar propias"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Las funciones SECURITY DEFINER pueden insertar sin restricción
CREATE POLICY "notifications: insertar (sistema)"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ----- STATUS LOG -----
CREATE POLICY "status_log: ver" ON order_status_log FOR SELECT TO authenticated USING (true);
-- Solo triggers insertan (SECURITY DEFINER)
CREATE POLICY "status_log: insertar (sistema)" ON order_status_log FOR INSERT TO authenticated WITH CHECK (true);

-- ----- CASH CLOSINGS -----
CREATE POLICY "cash_closings: ver (caja/admin)"
  ON cash_register_closings FOR SELECT TO authenticated
  USING (auth_user_role() IN ('admin', 'caja'));

CREATE POLICY "cash_closings: crear (caja/admin)"
  ON cash_register_closings FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin', 'caja'));

-- ============================================================
-- 6. STORAGE - BUCKET DE IMÁGENES
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "images: lectura pública"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "images: admin sube"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth_user_role() = 'admin'
  );

CREATE POLICY "images: admin actualiza"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth_user_role() = 'admin'
  );

CREATE POLICY "images: admin elimina"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth_user_role() = 'admin'
  );

-- ============================================================
-- 7. VISTAS PARA REPORTERÍA
-- ============================================================

CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  DATE(o.created_at AT TIME ZONE 'America/Bogota') AS sale_date,
  COUNT(*)                                          AS total_orders,
  COUNT(*) FILTER (WHERE o.status = 'entregado')    AS delivered_orders,
  COUNT(*) FILTER (WHERE o.status = 'cancelado')    AS cancelled_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'), 0) AS total_revenue,
  COALESCE(AVG(o.total) FILTER (WHERE o.status = 'entregado'), 0)::INTEGER AS avg_ticket
FROM orders o
GROUP BY DATE(o.created_at AT TIME ZONE 'America/Bogota')
ORDER BY sale_date DESC;

CREATE OR REPLACE VIEW v_hourly_sales AS
SELECT
  DATE(o.created_at AT TIME ZONE 'America/Bogota') AS sale_date,
  EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Bogota')::INTEGER AS hour,
  COUNT(*)      AS order_count,
  SUM(o.total)  AS total_revenue
FROM orders o
WHERE o.status != 'cancelado'
GROUP BY sale_date, hour
ORDER BY sale_date DESC, hour;

CREATE OR REPLACE VIEW v_top_products AS
SELECT
  p.id, p.name,
  c.label AS category,
  SUM(oi.quantity)                  AS total_quantity,
  SUM(oi.unit_price * oi.quantity)  AS total_revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN categories c ON c.id = p.category_id
JOIN orders o ON o.id = oi.order_id
WHERE o.status != 'cancelado'
GROUP BY p.id, p.name, c.label
ORDER BY total_quantity DESC;

CREATE OR REPLACE VIEW v_waiter_performance AS
SELECT
  pr.id AS user_id, pr.name AS waiter_name,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_revenue,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'), 0) AS delivered_revenue,
  COUNT(*) FILTER (WHERE o.status = 'cancelado') AS cancelled_orders
FROM profiles pr
LEFT JOIN orders o ON o.created_by = pr.id
WHERE pr.role = 'mesero'
GROUP BY pr.id, pr.name
ORDER BY total_revenue DESC;

-- ============================================================
-- 8. REALTIME (Websockets de Supabase)
-- ============================================================
-- Habilitar cambios en tiempo real para las tablas clave.
-- El frontend escucha estos cambios con supabase.channel().on()

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;

-- ============================================================
-- 9. SEED DATA
-- ============================================================

-- NOTA: Los usuarios se crean via Supabase Auth. Opciones:
--
-- Opción A - Dashboard: Authentication > Users > Add User
-- Opción B - JavaScript client:
--   supabase.auth.signUp({
--     email: 'admin@la30.com',
--     password: 'la30admin',
--     options: { data: { name: 'Admin', role: 'admin' } }
--   })
--
-- El trigger handle_new_user() creará el perfil automáticamente.
--
-- Usuarios para desarrollo:
-- | Email              | Password    | Rol     | Nombre         |
-- |--------------------|-------------|---------|----------------|
-- | admin@la30.com     | la30admin   | admin   | Admin          |
-- | caja@la30.com      | la30caja    | caja    | Carlos Caja    |
-- | mesero@la30.com    | la30mesero  | mesero  | María Mesera   |
-- | cocina@la30.com    | la30cocina  | cocina  | Pedro Cocina   |

-- --------- CATEGORÍAS ---------
INSERT INTO categories (name, label, icon, sort_order) VALUES
  ('perros',        'Perros',       '🌭', 1),
  ('hamburguesas',  'Hamburguesas', '🍔', 2),
  ('bebidas',       'Bebidas',      '🥤', 3),
  ('extras',        'Extras',       '🍟', 4);

-- --------- PRODUCTOS ---------
INSERT INTO products (name, category_id, price, available, sort_order) VALUES
  ('Perro Clásico',        (SELECT id FROM categories WHERE name = 'perros'),        8000,  TRUE, 1),
  ('Perro Especial La 30', (SELECT id FROM categories WHERE name = 'perros'),        12000, TRUE, 2),
  ('Perro Hawaiano',       (SELECT id FROM categories WHERE name = 'perros'),        10000, TRUE, 3),
  ('Perro Ranchero',       (SELECT id FROM categories WHERE name = 'perros'),        11000, TRUE, 4),
  ('Hamburguesa Clásica',  (SELECT id FROM categories WHERE name = 'hamburguesas'),  15000, TRUE, 5),
  ('Hamburguesa Doble',    (SELECT id FROM categories WHERE name = 'hamburguesas'),  20000, TRUE, 6),
  ('Hamburguesa BBQ',      (SELECT id FROM categories WHERE name = 'hamburguesas'),  18000, TRUE, 7),
  ('Hamburguesa La 30',    (SELECT id FROM categories WHERE name = 'hamburguesas'),  22000, TRUE, 8),
  ('Gaseosa',              (SELECT id FROM categories WHERE name = 'bebidas'),       3000,  TRUE, 9),
  ('Jugo Natural',         (SELECT id FROM categories WHERE name = 'bebidas'),       5000,  TRUE, 10),
  ('Agua',                 (SELECT id FROM categories WHERE name = 'bebidas'),       2000,  TRUE, 11),
  ('Papas Fritas',         (SELECT id FROM categories WHERE name = 'extras'),        6000,  TRUE, 12),
  ('Aros de Cebolla',      (SELECT id FROM categories WHERE name = 'extras'),        7000,  TRUE, 13),
  ('Salchipapa',           (SELECT id FROM categories WHERE name = 'extras'),        9000,  TRUE, 14);

-- --------- OPCIONES DE PERSONALIZACIÓN ---------
INSERT INTO product_custom_options (category_id, option_key, label, icon, sort_order) VALUES
  ((SELECT id FROM categories WHERE name = 'perros'), 'cebolla', 'Cebolla',        '🧅', 1),
  ((SELECT id FROM categories WHERE name = 'perros'), 'salsas',  'Salsas',         '🫙', 2),
  ((SELECT id FROM categories WHERE name = 'perros'), 'ripio',   'Ripio (papita)', '🥔', 3),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'verdura', 'Verduras', '🥗', 1),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'salsas',  'Salsas',   '🫙', 2);

-- Choices
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES ('sin','Sin cebolla','🚫',1),('cruda','Cruda','🥬',2),('sofrita','Sofrita','🍳',3)) AS v(value,label,icon,sort_order)
WHERE o.option_key='cebolla' AND o.category_id=(SELECT id FROM categories WHERE name='perros');

INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES ('con','Con salsas','✅',1),('sin','Sin salsas','🚫',2)) AS v(value,label,icon,sort_order)
WHERE o.option_key='salsas' AND o.category_id=(SELECT id FROM categories WHERE name='perros');

INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES ('con','Con ripio','✅',1),('sin','Sin ripio','🚫',2)) AS v(value,label,icon,sort_order)
WHERE o.option_key='ripio' AND o.category_id=(SELECT id FROM categories WHERE name='perros');

INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES ('completa','Completa','✅',1),('sin_tomate','Sin tomate','🍅🚫',2),('sin_lechuga','Sin lechuga','🥬🚫',3),('sin_verdura','Sin verduras','🚫',4)) AS v(value,label,icon,sort_order)
WHERE o.option_key='verdura' AND o.category_id=(SELECT id FROM categories WHERE name='hamburguesas');

INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES ('con','Con salsas','✅',1),('sin','Sin salsas','🚫',2)) AS v(value,label,icon,sort_order)
WHERE o.option_key='salsas' AND o.category_id=(SELECT id FROM categories WHERE name='hamburguesas');

-- --------- EXTRAS ---------
INSERT INTO product_extras (category_id, extra_key, label, icon, price_per_unit, max_qty, sort_order) VALUES
  ((SELECT id FROM categories WHERE name = 'perros'),       'salchicha_extra', 'Salchicha adicional', '🌭', 3000, 4, 1),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'queso_extra',     'Queso extra',        '🧀', 2000, 3, 1),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'tocineta',        'Tocineta',           '🥓', 3000, 2, 2);

-- ============================================================
-- RESUMEN DE USO DESDE EL FRONTEND
-- ============================================================
--
-- AUTH:
--   supabase.auth.signUp({ email, password, options: { data: { name, role } } })
--   supabase.auth.signInWithPassword({ email, password })
--   supabase.auth.signOut()
--   supabase.auth.getUser()
--
-- RPC (supabase.rpc('nombre', { params })):
--   get_my_profile()                    → perfil actual con rol
--   create_order(locator, items, notes) → crear pedido completo
--   update_order_status(order_id, status) → cambiar estado con validación
--   process_payment(order_id, method, amount_received) → cobrar
--   mark_notifications_read()           → marcar leídas
--   clear_my_notifications()            → limpiar notificaciones
--   get_unread_count()                  → conteo no leídas
--   generate_cash_closing(start, end)   → cierre de caja
--   get_all_users()                     → listar usuarios (admin)
--   update_user(user_id, ...)           → editar usuario (admin)
--   toggle_product_availability(id)     → toggle disponible
--   get_dashboard_stats()               → stats del dashboard
--   get_top_products(limit)             → productos más vendidos
--
-- REALTIME (supabase.channel('nombre').on('postgres_changes', ...)):
--   orders       → cambios en pedidos (nuevos, estado)
--   order_items  → items de pedidos
--   notifications → notificaciones nuevas para el usuario
--   products     → cambios en productos
--   categories   → cambios en categorías
--
-- STORAGE:
--   supabase.storage.from('product-images').upload(path, file)
--   supabase.storage.from('product-images').getPublicUrl(path)
--
-- QUERIES DIRECTAS:
--   supabase.from('products').select('*, categories(*)').eq('available', true)
--   supabase.from('orders').select('*, order_items(*, products(*))').order('created_at', { ascending: false })
--   supabase.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false })
--   supabase.from('v_daily_sales').select('*')
--   supabase.from('v_hourly_sales').select('*')
--   supabase.from('v_waiter_performance').select('*')


create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'cashier')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 1. Eliminar email de profiles (ya vive en auth.users, no debe estar aquí)
alter table public.profiles drop column email;

-- 2. Corregir el trigger con los valores correctos del enum
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Sin nombre'),
    coalesce(
      (new.raw_user_meta_data->>'role')::user_role,
      'mesero'::user_role
    )
  );
  return new;
end;
$$ language plpgsql security definer;