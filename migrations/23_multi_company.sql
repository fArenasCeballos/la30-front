-- ============================================================
-- SCRIPT 23: Multi-Company Support
-- Introduce tabla companies y vincula stores/profiles a empresas.
-- Migración idempotente y no destructiva.
-- ============================================================

-- ── 1. Tabla de empresas ────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL UNIQUE,
  slug          TEXT        NOT NULL UNIQUE,
  logo_url      TEXT,
  icon          TEXT,
  color         TEXT        NOT NULL DEFAULT '#6B7280',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  siigo_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  companies       IS 'Empresas/negocios independientes. Cada empresa tiene sus propios stores, productos, reportería y datos completamente aislados.';
COMMENT ON COLUMN companies.slug  IS 'Identificador URL-safe para persistencia en localStorage y rutas.';
COMMENT ON COLUMN companies.siigo_enabled IS 'Si la empresa tiene facturación electrónica Siigo activa.';

-- ── 2. Agregar company_id a stores ──────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_stores_company_id ON stores(company_id);

COMMENT ON COLUMN stores.company_id IS 'Empresa a la que pertenece este punto de venta.';

-- ── 2.1. Agregar company_id a delivery_zones ─────────────────
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_company_id ON delivery_zones(company_id);

COMMENT ON COLUMN delivery_zones.company_id IS 'Empresa a la que pertenece esta zona de cobertura.';

-- ── 2.2. Agregar company_id a delivery_drivers ───────────────
ALTER TABLE delivery_drivers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_company_id ON delivery_drivers(company_id);

COMMENT ON COLUMN delivery_drivers.company_id IS 'Empresa a la que pertenece este domiciliario.';

-- ── 2.3. Agregar company_id a coupons (si existe) ───────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons') THEN
    ALTER TABLE coupons ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
    CREATE INDEX IF NOT EXISTS idx_coupons_company_id ON coupons(company_id);
  END IF;
END $$;

-- ── 2.4. Agregar company_id a notifications (si existe) ─────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
    CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
  END IF;
END $$;

-- ── 2.5. Agregar company_id a internal_partners (si existe) ─
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'internal_partners') THEN
    ALTER TABLE internal_partners ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
    CREATE INDEX IF NOT EXISTS idx_internal_partners_company_id ON internal_partners(company_id);
  END IF;
END $$;

-- ── 3. Agregar company_ids[] a profiles ─────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_ids UUID[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_company_ids ON profiles USING GIN (company_ids);

COMMENT ON COLUMN profiles.company_ids IS 'Empresas a las que el usuario tiene acceso. NULL = acceso global (super-admin). Array con IDs = solo esas empresas.';

-- ── 4. Seed: Crear empresas ─────────────────────────────────
INSERT INTO companies (name, slug, icon, color, siigo_enabled) VALUES
  ('La 30 Perros y Hamburguesas', 'la30', '🏪', '#F97316', TRUE),
  ('Mirá Ve', 'mira-ve', '👑', '#D4A017', FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ── 5. Asignar TODOS los registros existentes a La 30 ───────
-- Todos los stores, zonas, domiciliarios y cupones actuales pertenecen a La 30
UPDATE stores
SET company_id = (SELECT id FROM companies WHERE slug = 'la30')
WHERE company_id IS NULL;

UPDATE delivery_zones
SET company_id = (SELECT id FROM companies WHERE slug = 'la30')
WHERE company_id IS NULL;

UPDATE delivery_drivers
SET company_id = (SELECT id FROM companies WHERE slug = 'la30')
WHERE company_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons') THEN
    UPDATE coupons
    SET company_id = (SELECT id FROM companies WHERE slug = 'la30')
    WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    UPDATE notifications
    SET company_id = (SELECT id FROM companies WHERE slug = 'la30')
    WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'internal_partners') THEN
    UPDATE internal_partners
    SET company_id = (SELECT id FROM companies WHERE slug = 'la30')
    WHERE company_id IS NULL;
  END IF;
END $$;

-- Asignar catálogo y menú existente (categorías, productos, extras, opciones) a las tiendas de La 30
UPDATE categories
SET store_ids = ARRAY(SELECT id FROM stores WHERE company_id = (SELECT id FROM companies WHERE slug = 'la30'))
WHERE store_ids IS NULL OR cardinality(store_ids) = 0;

UPDATE products
SET store_ids = ARRAY(SELECT id FROM stores WHERE company_id = (SELECT id FROM companies WHERE slug = 'la30'))
WHERE store_ids IS NULL OR cardinality(store_ids) = 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_extras') THEN
    UPDATE product_extras
    SET store_ids = ARRAY(SELECT id FROM stores WHERE company_id = (SELECT id FROM companies WHERE slug = 'la30'))
    WHERE store_ids IS NULL OR cardinality(store_ids) = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_custom_options') THEN
    UPDATE product_custom_options
    SET store_ids = ARRAY(SELECT id FROM stores WHERE company_id = (SELECT id FROM companies WHERE slug = 'la30'))
    WHERE store_ids IS NULL OR cardinality(store_ids) = 0;
  END IF;
END $$;

-- ── 5.1. Remover restricción UNIQUE global en stores.name ────
-- Dos empresas distintas pueden tener una tienda llamada 'Restaurante'.
-- El nombre ahora es único por empresa: (company_id, name).
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_company_id_name_key'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT stores_company_id_name_key UNIQUE (company_id, name);
  END IF;
END $$;

-- ── 6. Crear store "Restaurante" para Mirá Ve ───────────────
INSERT INTO stores (name, slug, icon, color, is_active, company_id)
VALUES (
  'Restaurante',
  'mira-ve-restaurante',
  '👑',
  '#D4A017',
  TRUE,
  (SELECT id FROM companies WHERE slug = 'mira-ve')
)
ON CONFLICT (slug) DO NOTHING;

-- ── 7. Hacer company_id NOT NULL en stores ──────────────────
ALTER TABLE stores
  ALTER COLUMN company_id SET NOT NULL;

-- ── 8. Asignar TODOS los profiles existentes a La 30 ───────
-- Todos los usuarios creados hasta ahora pertenecen a La 30.
-- El super-admin se ajustará manualmente después (company_ids = NULL).
UPDATE profiles
SET company_ids = ARRAY[(SELECT id FROM companies WHERE slug = 'la30')]
WHERE company_ids IS NULL;

-- ── 9. RPC: Obtener empresas accesibles por el usuario ──────
CREATE OR REPLACE FUNCTION get_user_companies()
RETURNS SETOF companies
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_ids UUID[];
BEGIN
  SELECT p.company_ids INTO v_company_ids
  FROM profiles p WHERE p.id = auth.uid();

  -- NULL = acceso global (todas las empresas activas)
  IF v_company_ids IS NULL OR array_length(v_company_ids, 1) IS NULL THEN
    RETURN QUERY SELECT * FROM companies WHERE is_active = TRUE ORDER BY created_at;
  ELSE
    RETURN QUERY SELECT * FROM companies
      WHERE id = ANY(v_company_ids) AND is_active = TRUE
      ORDER BY created_at;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_user_companies IS 'Retorna las empresas a las que el usuario autenticado tiene acceso. Si company_ids es NULL, retorna todas las empresas activas.';

-- ── 10. RPC: Admin actualiza acceso de empresa de un usuario ─
CREATE OR REPLACE FUNCTION update_user_company_access(
  p_user_id      UUID,
  p_company_ids  UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo admin puede ejecutar esto
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden modificar accesos de empresa';
  END IF;

  UPDATE profiles
    SET company_ids = CASE
          WHEN array_length(p_company_ids, 1) IS NULL THEN NULL  -- NULL o vacío => acceso global
          ELSE p_company_ids
        END,
        updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ── 10.1. Asegurar columna supplier_name en raw_material_entries ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_material_entries') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'raw_material_entries' AND column_name = 'supplier_name'
    ) THEN
      ALTER TABLE public.raw_material_entries ADD COLUMN supplier_name TEXT;
    END IF;
  END IF;
END $$;

-- ── 11. Verificar migración ─────────────────────────────────
SELECT 'EMPRESAS' AS seccion;
SELECT id, name, slug, icon, color, siigo_enabled FROM companies ORDER BY created_at;

SELECT 'STORES POR EMPRESA' AS seccion;
SELECT c.name AS empresa, s.name AS store, s.slug, s.is_active
FROM stores s
JOIN companies c ON s.company_id = c.id
ORDER BY c.name, s.created_at;

SELECT 'PERFILES' AS seccion;
SELECT p.name, p.email, p.role, p.company_ids,
  CASE
    WHEN p.company_ids IS NULL THEN 'ACCESO GLOBAL'
    ELSE (SELECT string_agg(c.name, ', ') FROM companies c WHERE c.id = ANY(p.company_ids))
  END AS empresas_asignadas
FROM profiles p
ORDER BY p.role, p.name;
