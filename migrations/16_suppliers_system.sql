-- ============================================================================
-- Migration 16: Suppliers Management
-- Re-executable (idempotent): uses IF NOT EXISTS, DO blocks
-- ============================================================================

-- ── 1. TABLA: suppliers ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  nit           TEXT NOT NULL,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, nit)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_store_id
  ON public.suppliers(store_id);

COMMENT ON TABLE public.suppliers
  IS 'Catálogo de proveedores por tienda';

-- RLS para proveedores
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'sup_select') THEN
    CREATE POLICY sup_select ON public.suppliers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'sup_insert') THEN
    CREATE POLICY sup_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'sup_update') THEN
    CREATE POLICY sup_update ON public.suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'sup_delete') THEN
    CREATE POLICY sup_delete ON public.suppliers FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ── 2. MODIFICAR: raw_material_entries ──────────────────────────────────────
DO $$ BEGIN
  -- Añadir supplier_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_material_entries' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE public.raw_material_entries
      ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rm_entries_supplier
  ON public.raw_material_entries(supplier_id);
