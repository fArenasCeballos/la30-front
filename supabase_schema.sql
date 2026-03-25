-- ============================================================
-- LA 30 - PERROS Y HAMBURGUESAS
-- Script SQL completo para Supabase (solo base de datos)
-- La lógica de negocio será manejada por el backend
-- ============================================================

-- ============================================================
-- 0. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TIPOS ENUM
-- ============================================================

-- Roles de usuario
CREATE TYPE user_role AS ENUM ('admin', 'caja', 'mesero', 'cocina');

-- Estados del pedido (flujo: pendiente → confirmado → en_preparacion → listo → entregado)
CREATE TYPE order_status AS ENUM (
  'pendiente',
  'confirmado',
  'en_preparacion',
  'listo',
  'entregado',
  'cancelado'
);

-- Métodos de pago
CREATE TYPE payment_method AS ENUM ('efectivo', 'tarjeta', 'nequi');

-- Tipos de notificación
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning');

-- ============================================================
-- 2. TABLAS
-- ============================================================

-- -----------------------
-- 2.1 PERFILES DE USUARIO (autenticación propia via backend)
-- -----------------------
CREATE TABLE profiles (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,  -- Hash bcrypt/argon2 generado por el backend
  role          user_role   NOT NULL DEFAULT 'mesero',
  avatar_url    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

COMMENT ON TABLE profiles IS 'Usuarios del sistema POS La 30. La autenticación (hash, JWT) se maneja en el backend.';
COMMENT ON COLUMN profiles.password_hash IS 'Hash de la contraseña generado por el backend (bcrypt o argon2). NUNCA almacenar en texto plano.';
COMMENT ON COLUMN profiles.role IS 'Rol del usuario: admin, caja, mesero, cocina';

-- -----------------------
-- 2.2 CATEGORÍAS DE PRODUCTO (tabla dinámica, no enum)
-- -----------------------
CREATE TABLE categories (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT    NOT NULL UNIQUE,  -- Ej: 'perros', 'hamburguesas', 'bebidas', 'extras'
  label       TEXT    NOT NULL,         -- Ej: 'Perros', 'Hamburguesas'
  icon        TEXT,                     -- Emoji: '🌭', '🍔', '🥤', '🍟'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE categories IS 'Categorías dinámicas de producto, gestionables desde el inventario';

-- -----------------------
-- 2.3 PRODUCTOS
-- -----------------------
CREATE TABLE products (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  price       INTEGER     NOT NULL CHECK (price >= 0),  -- Precio en COP (sin decimales)
  image_url   TEXT,                                      -- URL de la imagen en Supabase Storage
  available   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(available);

COMMENT ON TABLE products IS 'Catálogo de productos';
COMMENT ON COLUMN products.price IS 'Precio en pesos colombianos (COP), sin decimales';
COMMENT ON COLUMN products.image_url IS 'URL de la imagen almacenada en Supabase Storage bucket "product-images"';

-- -----------------------
-- 2.4 OPCIONES DE PERSONALIZACIÓN DE PRODUCTO
-- -----------------------
-- Se aplican por categoría. Ej: categoría "perros" tiene opción "Cebolla"
CREATE TABLE product_custom_options (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  option_key  TEXT    NOT NULL,   -- Ej: 'cebolla', 'salsas', 'verdura'
  label       TEXT    NOT NULL,   -- Ej: 'Cebolla'
  icon        TEXT,               -- '🧅'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(category_id, option_key)
);

COMMENT ON TABLE product_custom_options IS 'Opciones de personalización por categoría de producto';

-- -----------------------
-- 2.5 VALORES DE OPCIONES DE PERSONALIZACIÓN
-- -----------------------
CREATE TABLE product_custom_choices (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id   UUID    NOT NULL REFERENCES product_custom_options(id) ON DELETE CASCADE,
  value       TEXT    NOT NULL,   -- Ej: 'sin', 'cruda', 'sofrita'
  label       TEXT    NOT NULL,   -- Ej: 'Sin cebolla'
  icon        TEXT,               -- '🚫'
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
  label           TEXT    NOT NULL,        -- Ej: 'Salchicha adicional'
  icon            TEXT,                    -- '🌭'
  price_per_unit  INTEGER NOT NULL CHECK (price_per_unit >= 0),
  max_qty         INTEGER NOT NULL DEFAULT 1 CHECK (max_qty >= 1),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(category_id, extra_key)
);

COMMENT ON TABLE product_extras IS 'Adicionales de producto con precio extra (ej: queso extra, tocineta)';

-- -----------------------
-- 2.7 PEDIDOS (ORDERS)
-- -----------------------
CREATE TABLE orders (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  locator     TEXT          NOT NULL,         -- Localizador del cliente: "A-12", "B-05"
  status      order_status  NOT NULL DEFAULT 'pendiente',
  total       INTEGER       NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes       TEXT,                           -- Notas generales del pedido
  created_by  UUID          NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_locator ON orders(locator);
CREATE INDEX idx_orders_created_by ON orders(created_by);

COMMENT ON TABLE orders IS 'Pedidos del sistema POS';
COMMENT ON COLUMN orders.locator IS 'Identificador visual del pedido para el cliente (ej: A-12)';
COMMENT ON COLUMN orders.total IS 'Total en COP, calculado por el backend';

-- -----------------------
-- 2.8 ITEMS DEL PEDIDO
-- -----------------------
CREATE TABLE order_items (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID    NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  INTEGER NOT NULL CHECK (unit_price >= 0),  -- Precio unitario congelado (base + extras)
  notes       TEXT,                                       -- "Sin cebolla, +1 Queso extra"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

COMMENT ON TABLE order_items IS 'Líneas de detalle de cada pedido';
COMMENT ON COLUMN order_items.unit_price IS 'Precio unitario congelado al momento del pedido (incluye extras)';
COMMENT ON COLUMN order_items.notes IS 'Personalizaciones del item: Sin cebolla, +1 Queso extra, etc.';

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

COMMENT ON TABLE payments IS 'Registro de pagos de los pedidos';

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

COMMENT ON TABLE notifications IS 'Notificaciones del sistema, gestionadas por el backend';

-- -----------------------
-- 2.11 HISTORIAL DE CAMBIOS DE ESTADO (AUDIT LOG)
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

COMMENT ON TABLE order_status_log IS 'Auditoría de cambios de estado de pedidos, insertada por el backend';

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

COMMENT ON TABLE cash_register_closings IS 'Registro de cierres de caja, generado por el backend';

-- ============================================================
-- 3. TRIGGERS (solo los esenciales a nivel de DB)
-- ============================================================

-- Función genérica para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================
-- NOTA: Si el backend usa la service_role key de Supabase,
-- las políticas RLS se omiten automáticamente.
-- Estas políticas son una capa de seguridad adicional para
-- cuando se use la anon key o acceso directo desde el frontend.

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

-- Política genérica: el backend con service_role tiene acceso total.
-- Estas políticas aplican solo si se accede con anon/authenticated key.

-- PROFILES: lectura para todos los autenticados, escritura solo admin
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_manage" ON profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- CATEGORIES: lectura abierta, gestión por admin
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_manage" ON categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- PRODUCTS: lectura abierta, gestión por admin
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_manage" ON products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- CUSTOM OPTIONS & CHOICES: lectura abierta, gestión por admin
CREATE POLICY "custom_options_select" ON product_custom_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_options_manage" ON product_custom_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "custom_choices_select" ON product_custom_choices FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_choices_manage" ON product_custom_choices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- EXTRAS: lectura abierta, gestión por admin
CREATE POLICY "extras_select" ON product_extras FOR SELECT TO authenticated USING (true);
CREATE POLICY "extras_manage" ON product_extras FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ORDERS: lectura para todos, escritura por roles operativos
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'mesero', 'caja')));
CREATE POLICY "orders_update" ON orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'caja', 'cocina')));

-- ORDER ITEMS: lectura abierta, gestión por roles operativos
CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_manage" ON order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'mesero', 'caja')));

-- PAYMENTS: lectura abierta, inserción solo caja/admin
CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'caja')));

-- NOTIFICATIONS: solo las propias
CREATE POLICY "notifications_own" ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- STATUS LOG: lectura abierta
CREATE POLICY "status_log_select" ON order_status_log FOR SELECT TO authenticated USING (true);

-- CASH CLOSINGS: solo admin/caja
CREATE POLICY "cash_closings_select" ON cash_register_closings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'caja')));
CREATE POLICY "cash_closings_insert" ON cash_register_closings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'caja')));

-- ============================================================
-- 5. STORAGE - BUCKET PARA IMÁGENES DE PRODUCTOS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,  -- 5MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Escritura solo admin (subir, actualizar, eliminar)
CREATE POLICY "product_images_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "product_images_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 6. VISTAS ÚTILES PARA REPORTERÍA
-- ============================================================
-- Estas vistas son consultas prearmadas. El backend puede usarlas
-- directamente o hacer sus propias queries.

-- Resumen de ventas por día
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

-- Ventas por hora
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

-- Productos más vendidos
CREATE OR REPLACE VIEW v_top_products AS
SELECT
  p.id,
  p.name,
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

-- Rendimiento por mesero
CREATE OR REPLACE VIEW v_waiter_performance AS
SELECT
  pr.id        AS user_id,
  pr.name      AS waiter_name,
  COUNT(o.id)  AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_revenue,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'), 0) AS delivered_revenue,
  COUNT(*) FILTER (WHERE o.status = 'cancelado') AS cancelled_orders
FROM profiles pr
LEFT JOIN orders o ON o.created_by = pr.id
WHERE pr.role = 'mesero'
GROUP BY pr.id, pr.name
ORDER BY total_revenue DESC;

-- ============================================================
-- 7. REALTIME (opcional - si el frontend escucha cambios directamente)
-- ============================================================
-- Si todo pasa por el backend (websockets propios), estas líneas
-- pueden omitirse. Descomenta si necesitas Realtime de Supabase.

-- ALTER PUBLICATION supabase_realtime ADD TABLE orders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ============================================================
-- 8. SEED DATA
-- ============================================================

-- --------- USUARIOS SEED ---------
-- Las contraseñas se deben hashear en el backend al crear los usuarios.
-- Estos inserts usan un hash de ejemplo (bcrypt de 'la30admin', etc.)
-- En producción, el backend generará los hashes correctos.
--
-- Credenciales para desarrollo:
-- | Email              | Password    | Rol     | Nombre         |
-- |--------------------|-------------|---------|----------------|
-- | admin@la30.com     | la30admin   | admin   | Admin          |
-- | caja@la30.com      | la30caja    | caja    | Carlos Caja    |
-- | mesero@la30.com    | la30mesero  | mesero  | María Mesera   |
-- | cocina@la30.com    | la30cocina  | cocina  | Pedro Cocina   |

INSERT INTO profiles (name, email, password_hash, role) VALUES
  ('Admin',         'admin@la30.com',   crypt('la30admin',  gen_salt('bf')), 'admin'),
  ('Carlos Caja',   'caja@la30.com',    crypt('la30caja',   gen_salt('bf')), 'caja'),
  ('María Mesera',  'mesero@la30.com',   crypt('la30mesero', gen_salt('bf')), 'mesero'),
  ('Pedro Cocina',  'cocina@la30.com',   crypt('la30cocina', gen_salt('bf')), 'cocina');

-- --------- CATEGORÍAS SEED ---------
INSERT INTO categories (name, label, icon, sort_order) VALUES
  ('perros',        'Perros',         '🌭', 1),
  ('hamburguesas',  'Hamburguesas',   '🍔', 2),
  ('bebidas',       'Bebidas',        '🥤', 3),
  ('extras',        'Extras',         '🍟', 4);

-- --------- PRODUCTOS SEED ---------
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

-- --------- OPCIONES DE PERSONALIZACIÓN SEED ---------

-- Perros
INSERT INTO product_custom_options (category_id, option_key, label, icon, sort_order) VALUES
  ((SELECT id FROM categories WHERE name = 'perros'), 'cebolla', 'Cebolla',        '🧅', 1),
  ((SELECT id FROM categories WHERE name = 'perros'), 'salsas',  'Salsas',         '🫙', 2),
  ((SELECT id FROM categories WHERE name = 'perros'), 'ripio',   'Ripio (papita)', '🥔', 3);

-- Hamburguesas
INSERT INTO product_custom_options (category_id, option_key, label, icon, sort_order) VALUES
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'verdura', 'Verduras', '🥗', 1),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'salsas',  'Salsas',   '🫙', 2);

-- Choices para perros - cebolla
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('sin',     'Sin cebolla', '🚫', 1),
  ('cruda',   'Cruda',       '🥬', 2),
  ('sofrita', 'Sofrita',     '🍳', 3)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'cebolla'
  AND o.category_id = (SELECT id FROM categories WHERE name = 'perros');

-- Choices para perros - salsas
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('con', 'Con salsas', '✅', 1),
  ('sin', 'Sin salsas', '🚫', 2)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'salsas'
  AND o.category_id = (SELECT id FROM categories WHERE name = 'perros');

-- Choices para perros - ripio
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('con', 'Con ripio', '✅', 1),
  ('sin', 'Sin ripio', '🚫', 2)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'ripio'
  AND o.category_id = (SELECT id FROM categories WHERE name = 'perros');

-- Choices para hamburguesas - verdura
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('completa',    'Completa',     '✅',    1),
  ('sin_tomate',  'Sin tomate',   '🍅🚫', 2),
  ('sin_lechuga', 'Sin lechuga',  '🥬🚫', 3),
  ('sin_verdura', 'Sin verduras', '🚫',    4)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'verdura'
  AND o.category_id = (SELECT id FROM categories WHERE name = 'hamburguesas');

-- Choices para hamburguesas - salsas
INSERT INTO product_custom_choices (option_id, value, label, icon, sort_order)
SELECT o.id, v.value, v.label, v.icon, v.sort_order
FROM product_custom_options o
CROSS JOIN (VALUES
  ('con', 'Con salsas', '✅', 1),
  ('sin', 'Sin salsas', '🚫', 2)
) AS v(value, label, icon, sort_order)
WHERE o.option_key = 'salsas'
  AND o.category_id = (SELECT id FROM categories WHERE name = 'hamburguesas');

-- --------- EXTRAS SEED ---------
INSERT INTO product_extras (category_id, extra_key, label, icon, price_per_unit, max_qty, sort_order) VALUES
  ((SELECT id FROM categories WHERE name = 'perros'),       'salchicha_extra', 'Salchicha adicional', '🌭', 3000, 4, 1),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'queso_extra',     'Queso extra',        '🧀', 2000, 3, 1),
  ((SELECT id FROM categories WHERE name = 'hamburguesas'), 'tocineta',        'Tocineta',           '🥓', 3000, 2, 2);

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
-- Para ejecutar:
-- 1. Ir al SQL Editor de Supabase Dashboard
-- 2. Pegar este script completo y ejecutar
-- 3. Los 4 usuarios seed se crean con contraseñas hasheadas con bcrypt
-- 4. Las imágenes se suben al bucket "product-images"
-- 5. La lógica de negocio (auth JWT, crear pedidos, procesar pagos,
--    notificaciones, audit log, cierre de caja) se maneja en el backend
