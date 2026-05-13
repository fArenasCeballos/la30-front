-- ============================================================
-- SCRIPT 3: Agregar store_id a orders, profiles, cash_register_closings
--           + migrar datos existentes al Restaurante
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- UUIDs de las tiendas:
-- Restaurante:   ce7d0ef4-a580-41f6-86e3-7a68e58ce459
-- Carrito Móvil:  29935e37-362a-4556-87a8-a0b1732a29e1

-- ── 1. ORDERS: agregar store_id ──────────────────────────────
-- Cada pedido pertenece a UNA sola tienda
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

COMMENT ON COLUMN orders.store_id IS 'Tienda donde se creó este pedido.';

-- Migrar: todos los pedidos existentes → restaurante
UPDATE orders
SET store_id = 'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID
WHERE store_id IS NULL;

-- Hacer NOT NULL después de migrar
ALTER TABLE orders
  ALTER COLUMN store_id SET NOT NULL;

-- Índice para filtro por tienda
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);


-- ── 2. PROFILES: agregar store_id ────────────────────────────
-- Cada usuario trabaja en UNA tienda. NULL = admin (puede ver todas)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

COMMENT ON COLUMN profiles.store_id IS 'Tienda asignada al usuario. NULL = admin que puede ver todas las tiendas.';

-- Migrar: usuarios no-admin → restaurante, admins → NULL (pueden switchear)
UPDATE profiles
SET store_id = 'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID
WHERE role != 'admin' AND store_id IS NULL;

-- Admins quedan con store_id = NULL (seleccionan al ingresar)

CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);


-- ── 3. CASH_REGISTER_CLOSINGS: agregar store_id ──────────────
ALTER TABLE cash_register_closings
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

COMMENT ON COLUMN cash_register_closings.store_id IS 'Tienda del cierre de caja.';

-- Migrar existentes → restaurante
UPDATE cash_register_closings
SET store_id = 'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID
WHERE store_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_closings_store_id ON cash_register_closings(store_id);


-- ── 4. Verificar migración ───────────────────────────────────
SELECT 'orders' AS tabla,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE store_id IS NOT NULL) AS con_tienda
FROM orders
UNION ALL
SELECT 'profiles',
       COUNT(*),
       COUNT(*) FILTER (WHERE store_id IS NOT NULL OR role = 'admin')
FROM profiles
UNION ALL
SELECT 'cash_register_closings',
       COUNT(*),
       COUNT(*) FILTER (WHERE store_id IS NOT NULL)
FROM cash_register_closings;
