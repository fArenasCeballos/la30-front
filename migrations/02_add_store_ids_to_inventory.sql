-- ============================================================
-- SCRIPT 2: Agregar store_ids a tablas de inventario
--           + migrar datos existentes a Restaurante + Carrito
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- UUIDs de las tiendas (del Script 1):
-- Restaurante:   ce7d0ef4-a580-41f6-86e3-7a68e58ce459
-- Carrito Móvil:  29935e37-362a-4556-87a8-a0b1732a29e1

-- ── 1. CATEGORIES: agregar store_ids ─────────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS store_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN categories.store_ids IS 'Tiendas donde está disponible esta categoría.';

-- Migrar: todas las categorías existentes → restaurante + carrito
UPDATE categories
SET store_ids = ARRAY[
  'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID,
  '29935e37-362a-4556-87a8-a0b1732a29e1'::UUID
]
WHERE store_ids = '{}';


-- ── 2. PRODUCTS: agregar store_ids ───────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS store_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN products.store_ids IS 'Tiendas donde está disponible este producto.';

-- Migrar: todos los productos existentes → restaurante + carrito
UPDATE products
SET store_ids = ARRAY[
  'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID,
  '29935e37-362a-4556-87a8-a0b1732a29e1'::UUID
]
WHERE store_ids = '{}';


-- ── 3. PRODUCT_CUSTOM_OPTIONS: agregar store_ids ─────────────
ALTER TABLE product_custom_options
  ADD COLUMN IF NOT EXISTS store_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN product_custom_options.store_ids IS 'Tiendas donde está disponible esta opción de personalización.';

-- Migrar: todas las opciones existentes → restaurante + carrito
UPDATE product_custom_options
SET store_ids = ARRAY[
  'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID,
  '29935e37-362a-4556-87a8-a0b1732a29e1'::UUID
]
WHERE store_ids = '{}';


-- ── 4. PRODUCT_EXTRAS: agregar store_ids ─────────────────────
ALTER TABLE product_extras
  ADD COLUMN IF NOT EXISTS store_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN product_extras.store_ids IS 'Tiendas donde está disponible este extra.';

-- Migrar: todos los extras existentes → restaurante + carrito
UPDATE product_extras
SET store_ids = ARRAY[
  'ce7d0ef4-a580-41f6-86e3-7a68e58ce459'::UUID,
  '29935e37-362a-4556-87a8-a0b1732a29e1'::UUID
]
WHERE store_ids = '{}';


-- ── 5. Crear índices GIN para búsquedas eficientes por store ──
CREATE INDEX IF NOT EXISTS idx_categories_store_ids ON categories USING GIN (store_ids);
CREATE INDEX IF NOT EXISTS idx_products_store_ids ON products USING GIN (store_ids);
CREATE INDEX IF NOT EXISTS idx_custom_options_store_ids ON product_custom_options USING GIN (store_ids);
CREATE INDEX IF NOT EXISTS idx_extras_store_ids ON product_extras USING GIN (store_ids);


-- ── 6. Verificar migración ───────────────────────────────────
SELECT 'categories' AS tabla, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE array_length(store_ids, 1) > 0) AS con_tienda
FROM categories
UNION ALL
SELECT 'products', COUNT(*),
       COUNT(*) FILTER (WHERE array_length(store_ids, 1) > 0)
FROM products
UNION ALL
SELECT 'product_custom_options', COUNT(*),
       COUNT(*) FILTER (WHERE array_length(store_ids, 1) > 0)
FROM product_custom_options
UNION ALL
SELECT 'product_extras', COUNT(*),
       COUNT(*) FILTER (WHERE array_length(store_ids, 1) > 0)
FROM product_extras;
