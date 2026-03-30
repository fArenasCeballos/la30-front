-- ============================================================
-- LA 30 - PERROS Y HAMBURGUESAS
-- supabase_serverless.sql — v2 (limpio, sin backend externo)
-- Generado analizando el frontend completo
-- ============================================================
-- INSTRUCCIONES:
--   1. Abre el SQL Editor en tu proyecto de Supabase
--   2. Pega TODO este script y ejecútalo de una sola vez
--   3. Luego activa Realtime en Database → Replication para:
--      orders, order_items, notifications, products
--   4. El primer usuario admin lo creas desde
--      Authentication → Users → Add user (email + password)
--      y luego ejecutas el snippet al final para asignarle rol admin
-- ============================================================


-- ============================================================
-- 0. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. TIPOS ENUM
-- ============================================================
CREATE TYPE user_role       AS ENUM ('admin', 'caja', 'mesero', 'cocina');
CREATE TYPE order_status    AS ENUM ('pendiente','confirmado','en_preparacion','listo','entregado','cancelado');
CREATE TYPE payment_method  AS ENUM ('efectivo', 'tarjeta', 'nequi');
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning');


-- ============================================================
-- 2. TABLAS
-- ============================================================

-- ── 2.1 PERFILES ─────────────────────────────────────────────
-- Vinculado 1-a-1 con auth.users. Sin password_hash: Auth lo maneja.
-- El trigger handle_new_user() lo crea automáticamente al registrar.
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  role       user_role   NOT NULL DEFAULT 'mesero',
  avatar_url TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role  ON profiles(role);

COMMENT ON TABLE  profiles            IS 'Perfiles de usuario, vinculados a Supabase Auth.';
COMMENT ON COLUMN profiles.role       IS 'admin | caja | mesero | cocina';
COMMENT ON COLUMN profiles.is_active  IS 'Soft-delete: false = deshabilitado, no puede iniciar sesión.';


-- ── 2.2 CATEGORÍAS ───────────────────────────────────────────
-- Tabla dinámica: perros, hamburguesas, bebidas, extras.
-- El frontend las lee para el menú del Kiosko e Inventario.
CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,   -- clave interna: 'perros'
  label      TEXT        NOT NULL,          -- etiqueta UI: 'Perros'
  icon       TEXT,                          -- emoji: '🌭'
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE categories IS 'Categorías de producto (dinámicas, gestionadas desde Inventario).';


-- ── 2.3 PRODUCTOS ────────────────────────────────────────────
-- image_url guarda base64 o URL (Inventario.tsx usa FileReader → base64).
CREATE TABLE products (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT    NOT NULL,
  category_id UUID    NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  price       INTEGER NOT NULL CHECK (price >= 0),   -- COP sin decimales
  image_url   TEXT,                                  -- base64 o URL pública
  available   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_available ON products(available);

COMMENT ON COLUMN products.price     IS 'Precio en COP, sin decimales.';
COMMENT ON COLUMN products.image_url IS 'Base64 data-URL o URL pública. El frontend sube en base64 (máx 2 MB).';


-- ── 2.4 OPCIONES DE PERSONALIZACIÓN POR CATEGORÍA ────────────
-- Reemplaza los datos quemados en ProductCustomizer.tsx.
-- Ej: categoría "perros" → opción "cebolla" con choices cruda/sofrita/sin.
CREATE TABLE product_custom_options (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  option_key  TEXT    NOT NULL,   -- 'cebolla', 'salsas', 'ripio', 'verdura'
  label       TEXT    NOT NULL,   -- 'Cebolla'
  icon        TEXT,               -- '🧅'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, option_key)
);
COMMENT ON TABLE product_custom_options IS 'Grupos de personalización por categoría (cebolla, salsas, etc.).';


-- ── 2.5 VALORES DE OPCIONES ──────────────────────────────────
-- Los choices de cada opción: sin/cruda/sofrita para cebolla, etc.
CREATE TABLE product_custom_choices (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id  UUID    NOT NULL REFERENCES product_custom_options(id) ON DELETE CASCADE,
  value      TEXT    NOT NULL,   -- 'sin', 'cruda', 'sofrita'
  label      TEXT    NOT NULL,   -- 'Sin cebolla'
  icon       TEXT,               -- '🚫'
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(option_id, value)
);
COMMENT ON TABLE product_custom_choices IS 'Valores posibles de cada opción de personalización.';


-- ── 2.6 EXTRAS CON PRECIO ────────────────────────────────────
-- Adicionales con costo: salchicha extra, queso extra, tocineta.
-- Reemplaza PERROS_EXTRAS y HAMBURGUESAS_EXTRAS del ProductCustomizer.tsx.
CREATE TABLE product_extras (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id    UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  extra_key      TEXT    NOT NULL,             -- 'salchicha_extra'
  label          TEXT    NOT NULL,             -- 'Salchicha adicional'
  icon           TEXT,                         -- '🌭'
  price_per_unit INTEGER NOT NULL CHECK (price_per_unit >= 0),
  max_qty        INTEGER NOT NULL DEFAULT 1 CHECK (max_qty >= 1),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, extra_key)
);
COMMENT ON TABLE product_extras IS 'Adicionales con precio extra por categoría (queso, tocineta, etc.).';


-- ── 2.7 PEDIDOS ──────────────────────────────────────────────
-- locator: identificador visual para el cliente ("A-12", "B-05").
-- ticket_number: consecutivo numérico global, asignado automáticamente.
-- total: recalculado automáticamente por trigger al insertar/editar items.
CREATE SEQUENCE IF NOT EXISTS orders_ticket_seq START WITH 1;
CREATE TABLE orders (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  locator       TEXT         NOT NULL,
  ticket_number INTEGER      NOT NULL DEFAULT nextval('orders_ticket_seq') UNIQUE,
  status        order_status NOT NULL DEFAULT 'pendiente',
  total         INTEGER      NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes         TEXT,
  created_by    UUID         NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX idx_orders_locator       ON orders(locator);
CREATE INDEX idx_orders_created_by    ON orders(created_by);
CREATE INDEX idx_orders_ticket_number ON orders(ticket_number);

COMMENT ON COLUMN orders.locator       IS 'ID visual del cliente: A-12, B-05, etc.';
COMMENT ON COLUMN orders.ticket_number IS 'Consecutivo numérico global para recibos y comandas.';


-- ── 2.8 ITEMS DEL PEDIDO ─────────────────────────────────────
-- unit_price congelado al momento del pedido (precio base + extras).
-- notes: texto plano generado por ProductCustomizer ("Sin cebolla, +1 Queso extra").
CREATE TABLE order_items (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID    NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  notes      TEXT,                    -- "Sin cebolla, +1 Salchicha adicional"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

COMMENT ON COLUMN order_items.unit_price IS 'Precio unitario congelado al momento del pedido (base + extras).';
COMMENT ON COLUMN order_items.notes      IS 'Personalizaciones en texto: generadas por ProductCustomizer.tsx.';


-- ── 2.9 PAGOS ────────────────────────────────────────────────
-- Un pago por pedido. Procesado desde Caja → PaymentCalculator.tsx.
CREATE TABLE payments (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method          payment_method NOT NULL,
  amount_total    INTEGER        NOT NULL CHECK (amount_total >= 0),
  amount_received INTEGER        NOT NULL CHECK (amount_received >= 0),
  amount_change   INTEGER        NOT NULL DEFAULT 0 CHECK (amount_change >= 0),
  processed_by    UUID           NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order      ON payments(order_id);
CREATE INDEX idx_payments_method     ON payments(method);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

COMMENT ON TABLE payments IS 'Registro de cobros. Efectivo / Tarjeta / Nequi.';


-- ── 2.10 NOTIFICACIONES ──────────────────────────────────────
-- Generadas automáticamente por triggers al cambiar estado de pedidos.
-- El frontend las escucha por Realtime (NotificationBell / OrderContext).
CREATE TABLE notifications (
  id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    TEXT              NOT NULL,
  type       notification_type NOT NULL DEFAULT 'info',
  order_id   UUID              REFERENCES orders(id) ON DELETE SET NULL,
  read       BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user       ON notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'Notificaciones push por rol. Escuchadas via Supabase Realtime.';


-- ── 2.11 AUDIT LOG DE ESTADOS ────────────────────────────────
-- Registro inmutable de cada transición de estado de un pedido.
CREATE TABLE order_status_log (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status order_status,
  new_status      order_status NOT NULL,
  changed_by      UUID         REFERENCES profiles(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_log_order      ON order_status_log(order_id);
CREATE INDEX idx_status_log_created_at ON order_status_log(created_at DESC);

COMMENT ON TABLE order_status_log IS 'Trazabilidad inmutable de transiciones de estado por pedido.';


-- ── 2.12 CIERRE DE CAJA ──────────────────────────────────────
-- Snapshot generado por generate_cash_closing(). Llamado desde Reportería.
CREATE TABLE cash_register_closings (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  closed_by       UUID        NOT NULL REFERENCES profiles(id),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  total_sales     INTEGER     NOT NULL DEFAULT 0,
  total_orders    INTEGER     NOT NULL DEFAULT 0,
  delivered_count INTEGER     NOT NULL DEFAULT 0,
  pending_count   INTEGER     NOT NULL DEFAULT 0,
  pending_total   INTEGER     NOT NULL DEFAULT 0,
  cancelled_count INTEGER     NOT NULL DEFAULT 0,
  cancelled_total INTEGER     NOT NULL DEFAULT 0,
  cash_total      INTEGER     NOT NULL DEFAULT 0,
  card_total      INTEGER     NOT NULL DEFAULT 0,
  nequi_total     INTEGER     NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE cash_register_closings IS 'Snapshots de cierre de caja por período. Solo lectura después de creados.';


-- ============================================================
-- 3. TRIGGERS
-- ============================================================

-- ── 3.1 updated_at automático ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated   BEFORE UPDATE ON profiles   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated   BEFORE UPDATE ON products   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated     BEFORE UPDATE ON orders     FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3.2 Crear perfil al registrar usuario en Supabase Auth ───
-- Lee name y role del user_metadata que envía Usuarios.tsx en signUp.
-- También maneja la creación del primer admin (sin metadata).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
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
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 3.3 Recalcular total del pedido automáticamente ──────────
-- Se dispara tras INSERT / UPDATE / DELETE en order_items.
-- Así el frontend nunca calcula el total: lo lee directamente de orders.total.
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

CREATE TRIGGER trg_recalc_total_insert AFTER INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
CREATE TRIGGER trg_recalc_total_update AFTER UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();
CREATE TRIGGER trg_recalc_total_delete AFTER DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();


-- ── 3.4 Audit log automático de cambios de estado ────────────
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_log (order_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_status_log
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();


-- ── 3.5 Notificaciones automáticas por cambio de estado ──────
-- Genera una notificación para cada usuario activo del rol destino.
-- El frontend las recibe en tiempo real vía Supabase Realtime.
--
-- Flujo de notificaciones:
--   pendiente   → (sin notif, el mesero ya sabe)
--   confirmado  → notifica a cocina + admin
--   en_prep     → notifica a caja + admin
--   listo       → notifica a caja + mesero + admin  ← más importante
--   entregado   → notifica a admin
--   cancelado   → notifica a cocina + caja + admin
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_message      TEXT;
  v_type         notification_type;
  v_target_roles user_role[];
  v_uid          UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'confirmado' THEN
      v_message      := '✅ Pedido ' || NEW.locator || ' confirmado — pendiente de cobro';
      v_type         := 'info';
      v_target_roles := ARRAY['cocina','admin']::user_role[];

    WHEN 'en_preparacion' THEN
      v_message      := '👨‍🍳 Pedido ' || NEW.locator || ' enviado a cocina';
      v_type         := 'info';
      v_target_roles := ARRAY['cocina','admin']::user_role[];

    WHEN 'listo' THEN
      v_message      := '🔔 Pedido ' || NEW.locator || ' ¡LISTO! Llamar al cliente';
      v_type         := 'success';
      v_target_roles := ARRAY['caja','mesero','admin']::user_role[];

    WHEN 'entregado' THEN
      v_message      := '💰 Pedido ' || NEW.locator || ' entregado y cobrado';
      v_type         := 'info';
      v_target_roles := ARRAY['admin']::user_role[];

    WHEN 'cancelado' THEN
      v_message      := '❌ Pedido ' || NEW.locator || ' cancelado';
      v_type         := 'warning';
      v_target_roles := ARRAY['cocina','caja','admin']::user_role[];

    ELSE
      RETURN NEW;
  END CASE;

  FOR v_uid IN
    SELECT id FROM profiles
    WHERE role = ANY(v_target_roles) AND is_active = TRUE
  LOOP
    INSERT INTO notifications (user_id, message, type, order_id)
    VALUES (v_uid, v_message, v_type, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();


-- ── 3.6 Notificación al crear nuevo pedido ───────────────────
-- Avisa a caja y admin que hay un pedido nuevo esperando confirmación.
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT id FROM profiles
    WHERE role IN ('caja','admin') AND is_active = TRUE
  LOOP
    INSERT INTO notifications (user_id, message, type, order_id)
    VALUES (v_uid, '🆕 Nuevo pedido ' || NEW.locator || ' esperando confirmación', 'info', NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_new_order();


-- ============================================================
-- 4. FUNCIONES RPC
-- Llamadas directamente desde el frontend con supabase.rpc(...)
-- ============================================================

-- ── 4.1 Crear pedido transaccional ───────────────────────────
-- Usado en OrderContext.tsx → addOrder()
-- Valida productos, calcula total, crea order + items en una transacción.
CREATE OR REPLACE FUNCTION create_order(
  p_locator TEXT,
  p_items   JSONB,    -- [{"product_id":"uuid","quantity":2,"unit_price":12000,"notes":"Sin cebolla"}]
  p_notes   TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id      UUID;
  v_ticket_number INTEGER;
  v_total         INTEGER := 0;
  v_item          JSONB;
  v_product       RECORD;
BEGIN
  -- Validar rol
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','mesero','caja') AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Sin permisos para crear pedidos';
  END IF;

  IF p_locator IS NULL OR trim(p_locator) = '' THEN
    RAISE EXCEPTION 'El localizador es obligatorio';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El pedido debe tener al menos un producto';
  END IF;

  -- Validar productos y calcular total
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

  -- Crear orden (ticket_number se asigna automáticamente via DEFAULT nextval)
  INSERT INTO orders (locator, status, total, notes, created_by)
  VALUES (trim(p_locator), 'pendiente', v_total, p_notes, auth.uid())
  RETURNING id, ticket_number INTO v_order_id, v_ticket_number;

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
    'order_id',      v_order_id,
    'locator',       trim(p_locator),
    'total',         v_total,
    'status',        'pendiente',
    'ticket_number', v_ticket_number
  );
END;
$$;


-- ── 4.2 Actualizar estado del pedido ─────────────────────────
-- Usado en OrderContext.tsx → updateOrderStatus()
-- Valida la transición de estado según el rol del usuario.
--
-- Flujo permitido:
--   pendiente → confirmado       (caja / admin)
--   confirmado → en_preparacion  (caja / cocina / admin — tras cobro)
--   en_preparacion → listo       (cocina / admin)
--   listo → entregado            (caja / admin)
--   cualquier → cancelado        (caja / admin, excepto si ya está entregado/cancelado)
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id UUID,
  p_status   order_status
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order     RECORD;
  v_user_role user_role;
  v_allowed   BOOLEAN := FALSE;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado o inactivo';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  CASE p_status
    WHEN 'confirmado' THEN
      v_allowed := v_user_role IN ('caja','admin') AND v_order.status = 'pendiente';

    WHEN 'en_preparacion' THEN
      v_allowed := v_user_role IN ('caja','cocina','admin') AND v_order.status = 'confirmado';

    WHEN 'listo' THEN
      v_allowed := v_user_role IN ('cocina','admin') AND v_order.status = 'en_preparacion';

    WHEN 'entregado' THEN
      v_allowed := v_user_role IN ('caja','admin') AND v_order.status = 'listo';

    WHEN 'cancelado' THEN
      v_allowed := v_user_role IN ('caja','admin')
                   AND v_order.status NOT IN ('entregado','cancelado');

    ELSE
      RAISE EXCEPTION 'Estado inválido: %', p_status;
  END CASE;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transición no permitida: % → % (rol: %)',
      v_order.status, p_status, v_user_role;
  END IF;

  UPDATE orders SET status = p_status WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'order_id',        p_order_id,
    'locator',         v_order.locator,
    'previous_status', v_order.status,
    'new_status',      p_status
  );
END;
$$;


-- ── 4.3 Procesar pago ────────────────────────────────────────
-- Usado en OrderContext.tsx → processPayment()
-- Registra el pago y avanza el pedido a en_preparacion automáticamente.
CREATE OR REPLACE FUNCTION process_payment(
  p_order_id        UUID,
  p_method          payment_method,
  p_amount_received INTEGER
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_payment_id UUID;
  v_change     INTEGER;
  v_user_role  user_role;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_user_role NOT IN ('caja','admin') THEN
    RAISE EXCEPTION 'Solo caja o admin pueden procesar pagos';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF v_order.status != 'confirmado' THEN
    RAISE EXCEPTION 'El pedido debe estar confirmado para cobrar (estado actual: %)', v_order.status;
  END IF;
  IF p_amount_received < v_order.total THEN
    RAISE EXCEPTION 'Monto insuficiente: recibido $% de $%', p_amount_received, v_order.total;
  END IF;

  v_change := p_amount_received - v_order.total;

  INSERT INTO payments (order_id, method, amount_total, amount_received, amount_change, processed_by)
  VALUES (p_order_id, p_method, v_order.total, p_amount_received, v_change, auth.uid())
  RETURNING id INTO v_payment_id;

  -- Avanzar automáticamente a en_preparacion
  UPDATE orders SET status = 'en_preparacion' WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'order_id',   p_order_id,
    'locator',    v_order.locator,
    'method',     p_method,
    'total',      v_order.total,
    'received',   p_amount_received,
    'change',     v_change,
    'new_status', 'en_preparacion'
  );
END;
$$;


-- ── 4.4 Notificaciones ───────────────────────────────────────
-- Usadas en OrderContext.tsx

CREATE OR REPLACE FUNCTION mark_notifications_read()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET read = TRUE WHERE user_id = auth.uid() AND read = FALSE;
$$;

CREATE OR REPLACE FUNCTION clear_my_notifications()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM notifications WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER FROM notifications WHERE user_id = auth.uid() AND read = FALSE;
$$;


-- ── 4.5 Cierre de caja ───────────────────────────────────────
-- Usado desde Reportería. Genera un snapshot del período y lo persiste.
CREATE OR REPLACE FUNCTION generate_cash_closing(
  p_period_start TIMESTAMPTZ,
  p_period_end   TIMESTAMPTZ,
  p_notes        TEXT DEFAULT NULL
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
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_user_role NOT IN ('caja','admin') THEN
    RAISE EXCEPTION 'Solo caja o admin pueden generar cierres de caja';
  END IF;

  -- Totales de pedidos en el período
  SELECT
    COALESCE(SUM(total)  FILTER (WHERE status = 'entregado'),                        0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'entregado'),
    COUNT(*) FILTER (WHERE status NOT IN ('entregado','cancelado')),
    COALESCE(SUM(total)  FILTER (WHERE status NOT IN ('entregado','cancelado')),      0),
    COUNT(*) FILTER (WHERE status = 'cancelado'),
    COALESCE(SUM(total)  FILTER (WHERE status = 'cancelado'),                        0)
  INTO v_total_sales, v_total_orders, v_delivered,
       v_pending_cnt, v_pending_total, v_cancelled_cnt, v_cancelled_tot
  FROM orders
  WHERE created_at BETWEEN p_period_start AND p_period_end;

  -- Pagos por método
  SELECT
    COALESCE(SUM(amount_total) FILTER (WHERE method = 'efectivo'), 0),
    COALESCE(SUM(amount_total) FILTER (WHERE method = 'tarjeta'),  0),
    COALESCE(SUM(amount_total) FILTER (WHERE method = 'nequi'),    0)
  INTO v_cash, v_card, v_nequi
  FROM payments
  WHERE created_at BETWEEN p_period_start AND p_period_end;

  INSERT INTO cash_register_closings (
    closed_by, period_start, period_end,
    total_sales, total_orders, delivered_count,
    pending_count, pending_total,
    cancelled_count, cancelled_total,
    cash_total, card_total, nequi_total, notes
  ) VALUES (
    auth.uid(), p_period_start, p_period_end,
    v_total_sales, v_total_orders, v_delivered,
    v_pending_cnt, v_pending_total,
    v_cancelled_cnt, v_cancelled_tot,
    v_cash, v_card, v_nequi, p_notes
  ) RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'closing_id',    v_closing_id,
    'total_sales',   v_total_sales,
    'total_orders',  v_total_orders,
    'delivered',     v_delivered,
    'pending',       v_pending_cnt,
    'cancelled',     v_cancelled_cnt,
    'cash',          v_cash,
    'card',          v_card,
    'nequi',         v_nequi
  );
END;
$$;


-- ── 4.6 Dashboard stats ──────────────────────────────────────
-- Usado en Dashboard.tsx. Devuelve métricas del día en Bogotá.
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today_start  TIMESTAMPTZ;
  v_revenue      INTEGER;
  v_active       INTEGER;
  v_completed    INTEGER;
  v_cancelled    INTEGER;
  v_avg_ticket   INTEGER;
BEGIN
  v_today_start := DATE_TRUNC('day', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota';

  SELECT
    COALESCE(SUM(total) FILTER (WHERE status = 'entregado'),                                0),
    COUNT(*)            FILTER (WHERE status IN ('pendiente','confirmado','en_preparacion','listo')),
    COUNT(*)            FILTER (WHERE status = 'entregado'),
    COUNT(*)            FILTER (WHERE status = 'cancelado')
  INTO v_revenue, v_active, v_completed, v_cancelled
  FROM orders
  WHERE created_at >= v_today_start;

  v_avg_ticket := CASE WHEN v_completed > 0 THEN v_revenue / v_completed ELSE 0 END;

  RETURN jsonb_build_object(
    'total_revenue',   v_revenue,
    'active_orders',   v_active,
    'completed_today', v_completed,
    'cancelled_today', v_cancelled,
    'avg_ticket',      v_avg_ticket
  );
END;
$$;


-- ── 4.7 Top productos ────────────────────────────────────────
-- Usado en Dashboard.tsx → productStats
CREATE OR REPLACE FUNCTION get_top_products(p_limit INTEGER DEFAULT 6)
RETURNS TABLE (product_name TEXT, category TEXT, quantity BIGINT, revenue BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.name,
    c.label,
    SUM(oi.quantity)               AS quantity,
    SUM(oi.unit_price * oi.quantity) AS revenue
  FROM order_items oi
  JOIN products   p ON p.id = oi.product_id
  JOIN categories c ON c.id = p.category_id
  JOIN orders     o ON o.id = oi.order_id
  WHERE o.status != 'cancelado'
  GROUP BY p.name, c.label
  ORDER BY quantity DESC
  LIMIT p_limit;
$$;


-- ── 4.8 Gestión de usuarios (solo admin) ─────────────────────
-- Usuarios.tsx lee profiles directamente con RLS,
-- pero estas RPCs añaden validación de rol server-side.

-- Actualizar nombre / rol / estado de un usuario
CREATE OR REPLACE FUNCTION update_user(
  p_user_id   UUID,
  p_name      TEXT    DEFAULT NULL,
  p_role      user_role DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede editar usuarios';
  END IF;

  UPDATE profiles SET
    name      = COALESCE(p_name,      name),
    role      = COALESCE(p_role,      role),
    is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id, 'updated', TRUE);
END;
$$;

-- Toggle disponibilidad de producto (Inventario.tsx)
CREATE OR REPLACE FUNCTION toggle_product_availability(p_product_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Helper de rol para RLS (evita subqueries repetidas en políticas)
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


-- ── 4.9 Obtener opciones y extras de personalización ─────────
-- Reemplaza los datos quemados en ProductCustomizer.tsx.
-- El Kiosko llama esto al abrir el customizer de un producto.
CREATE OR REPLACE FUNCTION get_customization_for_category(p_category_name TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'options', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         pco.id,
          'option_key', pco.option_key,
          'label',      pco.label,
          'icon',       pco.icon,
          'choices', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',    pcc.id,
                'value', pcc.value,
                'label', pcc.label,
                'icon',  pcc.icon
              ) ORDER BY pcc.sort_order
            )
            FROM product_custom_choices pcc WHERE pcc.option_id = pco.id
          )
        ) ORDER BY pco.sort_order
      )
      FROM product_custom_options pco
      JOIN categories c ON c.id = pco.category_id
      WHERE c.name = p_category_name
    ), '[]'::jsonb),
    'extras', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            pe.id,
          'extra_key',     pe.extra_key,
          'label',         pe.label,
          'icon',          pe.icon,
          'price_per_unit', pe.price_per_unit,
          'max_qty',       pe.max_qty
        ) ORDER BY pe.sort_order
      )
      FROM product_extras pe
      JOIN categories c ON c.id = pe.category_id
      WHERE c.name = p_category_name
    ), '[]'::jsonb)
  );
$$;


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_custom_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_custom_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_extras         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_closings ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ─────────────────────────────────────────────────
-- Cualquier usuario autenticado puede ver todos los perfiles (Usuarios.tsx los lista).
-- Solo el propio usuario puede editarse, y admin puede gestionar a todos.
CREATE POLICY "profiles: ver todos"
  ON profiles FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "profiles: editar propio"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: admin gestiona"
  ON profiles FOR ALL TO authenticated
  USING (auth_user_role() = 'admin');

-- ── CATEGORIES ───────────────────────────────────────────────
CREATE POLICY "categories: ver"    ON categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "categories: admin"  ON categories FOR ALL    TO authenticated USING (auth_user_role() = 'admin');

-- ── PRODUCTS ─────────────────────────────────────────────────
CREATE POLICY "products: ver"      ON products FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "products: admin"    ON products FOR ALL    TO authenticated USING (auth_user_role() = 'admin');

-- ── OPCIONES Y EXTRAS ────────────────────────────────────────
CREATE POLICY "custom_options: ver"   ON product_custom_options FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "custom_options: admin" ON product_custom_options FOR ALL    TO authenticated USING (auth_user_role() = 'admin');

CREATE POLICY "custom_choices: ver"   ON product_custom_choices FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "custom_choices: admin" ON product_custom_choices FOR ALL    TO authenticated USING (auth_user_role() = 'admin');

CREATE POLICY "extras: ver"           ON product_extras FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "extras: admin"         ON product_extras FOR ALL    TO authenticated USING (auth_user_role() = 'admin');

-- ── ORDERS ───────────────────────────────────────────────────
-- Todos los autenticados ven todos los pedidos (Cocina, Caja, Dashboard los necesitan).
-- Insertar: mesero, caja, admin. Actualizar: caja, cocina, admin.
CREATE POLICY "orders: ver"
  ON orders FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "orders: crear"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin','mesero','caja'));

CREATE POLICY "orders: actualizar"
  ON orders FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('admin','caja','cocina'));

-- ── ORDER ITEMS ──────────────────────────────────────────────
CREATE POLICY "order_items: ver"
  ON order_items FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "order_items: gestionar"
  ON order_items FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin','mesero','caja'));

-- ── PAYMENTS ─────────────────────────────────────────────────
CREATE POLICY "payments: ver"
  ON payments FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "payments: insertar"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin','caja'));

-- ── NOTIFICATIONS ────────────────────────────────────────────
-- Cada usuario solo ve y gestiona sus propias notificaciones.
CREATE POLICY "notifications: propias"
  ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ── STATUS LOG ───────────────────────────────────────────────
CREATE POLICY "status_log: ver"
  ON order_status_log FOR SELECT TO authenticated USING (TRUE);

-- ── CASH CLOSINGS ────────────────────────────────────────────
CREATE POLICY "cash_closings: ver"
  ON cash_register_closings FOR SELECT TO authenticated
  USING (auth_user_role() IN ('admin','caja'));

CREATE POLICY "cash_closings: insertar"
  ON cash_register_closings FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('admin','caja'));


-- ============================================================
-- 6. VISTAS PARA REPORTERÍA
-- ============================================================

-- Ventas por día (Reportería.tsx)
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  DATE(o.created_at AT TIME ZONE 'America/Bogota') AS sale_date,
  COUNT(*)                                           AS total_orders,
  COUNT(*) FILTER (WHERE o.status = 'entregado')     AS delivered_orders,
  COUNT(*) FILTER (WHERE o.status = 'cancelado')     AS cancelled_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'), 0) AS total_revenue,
  COALESCE(AVG(o.total) FILTER (WHERE o.status = 'entregado'), 0)::INTEGER AS avg_ticket
FROM orders o
GROUP BY DATE(o.created_at AT TIME ZONE 'America/Bogota')
ORDER BY sale_date DESC;

-- Ventas por hora (para gráfico de calor)
CREATE OR REPLACE VIEW v_hourly_sales AS
SELECT
  DATE(o.created_at AT TIME ZONE 'America/Bogota')                         AS sale_date,
  EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Bogota')::INTEGER   AS hour,
  COUNT(*)                                                                   AS order_count,
  COALESCE(SUM(o.total), 0)                                                 AS total_revenue
FROM orders o
WHERE o.status != 'cancelado'
GROUP BY sale_date, hour
ORDER BY sale_date DESC, hour;

-- Productos más vendidos (histórico)
CREATE OR REPLACE VIEW v_top_products AS
SELECT
  p.id,
  p.name,
  c.label AS category,
  SUM(oi.quantity)                AS total_quantity,
  SUM(oi.unit_price * oi.quantity) AS total_revenue
FROM order_items oi
JOIN products   p ON p.id = oi.product_id
JOIN categories c ON c.id = p.category_id
JOIN orders     o ON o.id = oi.order_id
WHERE o.status != 'cancelado'
GROUP BY p.id, p.name, c.label
ORDER BY total_quantity DESC;

-- Rendimiento por mesero (Usuarios.tsx stats)
CREATE OR REPLACE VIEW v_waiter_performance AS
SELECT
  pr.id          AS user_id,
  pr.name        AS waiter_name,
  COUNT(o.id)    AS total_orders,
  COALESCE(SUM(o.total),                                          0) AS total_revenue,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'),   0) AS delivered_revenue,
  COUNT(*)       FILTER (WHERE o.status = 'cancelado')               AS cancelled_orders
FROM profiles pr
LEFT JOIN orders o ON o.created_by = pr.id
WHERE pr.role = 'mesero'
GROUP BY pr.id, pr.name
ORDER BY delivered_revenue DESC;


-- ============================================================
-- 7. REALTIME
-- Activa las tablas que el frontend escucha en OrderContext.tsx
-- y NotificationBell. Si prefieres, hazlo desde el dashboard
-- en Database → Replication → supabase_realtime publication.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE products;


-- ============================================================
-- 8. SEED DATA
-- ============================================================

-- ── Categorías ───────────────────────────────────────────────
INSERT INTO categories (name, label, icon, sort_order) VALUES
  ('perros',        'Perros',        '🌭', 1),
  ('hamburguesas',  'Hamburguesas',  '🍔', 2),
  ('bebidas',       'Bebidas',       '🥤', 3),
  ('extras',        'Extras',        '🍟', 4);

-- ── Productos ────────────────────────────────────────────────
INSERT INTO products (name, category_id, price, available, sort_order) VALUES
  ('Perro Clásico',           (SELECT id FROM categories WHERE name='perros'),       8000, TRUE, 1),
  ('Perro Especial La 30',    (SELECT id FROM categories WHERE name='perros'),      12000, TRUE, 2),
  ('Perro Hawaiano',          (SELECT id FROM categories WHERE name='perros'),      10000, TRUE, 3),
  ('Perro Ranchero',          (SELECT id FROM categories WHERE name='perros'),      11000, TRUE, 4),
  ('Hamburguesa Clásica',     (SELECT id FROM categories WHERE name='hamburguesas'),15000, TRUE, 5),
  ('Hamburguesa Doble',       (SELECT id FROM categories WHERE name='hamburguesas'),20000, TRUE, 6),
  ('Hamburguesa BBQ',         (SELECT id FROM categories WHERE name='hamburguesas'),18000, TRUE, 7),
  ('Hamburguesa La 30',       (SELECT id FROM categories WHERE name='hamburguesas'),22000, TRUE, 8),
  ('Gaseosa',                 (SELECT id FROM categories WHERE name='bebidas'),      3000, TRUE, 9),
  ('Jugo Natural',            (SELECT id FROM categories WHERE name='bebidas'),      5000, TRUE,10),
  ('Agua',                    (SELECT id FROM categories WHERE name='bebidas'),      2000, TRUE,11),
  ('Papas Fritas',            (SELECT id FROM categories WHERE name='extras'),       6000, TRUE,12),
  ('Aros de Cebolla',         (SELECT id FROM categories WHERE name='extras'),       7000, TRUE,13),
  ('Salchipapa',              (SELECT id FROM categories WHERE name='extras'),       9000, TRUE,14);

-- ── Opciones de personalización ──────────────────────────────
-- Opciones para perros
INSERT INTO product_custom_options (category_id, option_key, label, icon, sort_order) VALUES
  ((SELECT id FROM categories WHERE name='perros'), 'cebolla', 'Cebolla',       '🧅', 1),
  ((SELECT id FROM categories WHERE name='perros'), 'salsas',  'Salsas',        '🫙', 2),
  ((SELECT id FROM categories WHERE name='perros'), 'ripio',   'Ripio (papita)','🥔', 3);

-- Opciones para hamburguesas
INSERT INTO product_custom_options (category_id, option_key, label, icon, sort_order) VALUES
  ((SELECT id FROM categories WHERE name='hamburguesas'), 'verdura', 'Verduras','🥗', 1),
  ((SELECT id FROM categories WHERE name='hamburguesas'), 'salsas',  'Salsas',  '🫙', 2);

-- Choices: perros → cebolla
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('sin',    'Sin cebolla', '🚫', 1),
  ('cruda',  'Cruda',       '🥬', 2),
  ('sofrita','Sofrita',     '🍳', 3)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'cebolla'
  AND o.category_id = (SELECT id FROM categories WHERE name='perros');

-- Choices: perros → salsas
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('con', 'Con salsas', '✅', 1),
  ('sin', 'Sin salsas', '🚫', 2)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'salsas'
  AND o.category_id = (SELECT id FROM categories WHERE name='perros');

-- Choices: perros → ripio
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('con', 'Con ripio', '✅', 1),
  ('sin', 'Sin ripio', '🚫', 2)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'ripio'
  AND o.category_id = (SELECT id FROM categories WHERE name='perros');

-- Choices: hamburguesas → verdura
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('completa',    'Completa',      '✅',    1),
  ('sin_tomate',  'Sin tomate',    '🍅🚫', 2),
  ('sin_lechuga', 'Sin lechuga',   '🥬🚫', 3),
  ('sin_verdura', 'Sin verduras',  '🚫',   4)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'verdura'
  AND o.category_id = (SELECT id FROM categories WHERE name='hamburguesas');

-- Choices: hamburguesas → salsas
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('con', 'Con salsas', '✅', 1),
  ('sin', 'Sin salsas', '🚫', 2)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'salsas'
  AND o.category_id = (SELECT id FROM categories WHERE name='hamburguesas');

-- ── Extras con precio ────────────────────────────────────────
INSERT INTO product_extras (category_id, extra_key, label, icon, price_per_unit, max_qty, sort_order) VALUES
  ((SELECT id FROM categories WHERE name='perros'),       'salchicha_extra', 'Salchicha adicional', '🌭', 3000, 4, 1),
  ((SELECT id FROM categories WHERE name='hamburguesas'), 'queso_extra',     'Queso extra',         '🧀', 2000, 3, 1),
  ((SELECT id FROM categories WHERE name='hamburguesas'), 'tocineta',        'Tocineta',            '🥓', 3000, 2, 2);


-- ============================================================
-- 9. PRIMER USUARIO ADMIN
-- ============================================================
-- El trigger handle_new_user() crea el perfil automáticamente
-- cuando creas el usuario en Authentication → Users → Add user.
--
-- DESPUÉS de crear el usuario en el dashboard, ejecuta esto
-- reemplazando el email para promoverlo a admin:
--
--   UPDATE profiles SET role = 'admin' WHERE email = 'tu@email.com';
--
-- Los demás usuarios los crea el admin desde el módulo Usuarios
-- usando supabase.auth.signUp() con el metadata { full_name, role }.
-- El trigger los promueve al rol correcto automáticamente.
-- ============================================================


-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================