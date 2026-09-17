-- ============================================================
-- SCRIPT 24: Recipe Costing & Profitability Management
-- Introduce costo unitario en raw_materials y flag de rentabilidad en companies
-- Migración idempotente y no destructiva.
-- ============================================================

-- ── 1. Agregar profitability_enabled a companies ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'profitability_enabled'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN profitability_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    COMMENT ON COLUMN public.companies.profitability_enabled
      IS 'Determina si la empresa tiene activo el cálculo de rentabilidad, ganancias e ingresos en Dashboard y Reportería.';
  END IF;
END $$;

-- ── 2. Agregar cost_per_unit a raw_materials ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_materials' AND column_name = 'cost_per_unit'
  ) THEN
    ALTER TABLE public.raw_materials
      ADD COLUMN cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0;
    COMMENT ON COLUMN public.raw_materials.cost_per_unit
      IS 'Costo de referencia por unidad de medida base (g, ml, unidad). Se actualiza con compras o manualmente.';
  END IF;
END $$;

-- ── 3. Inicializar cost_per_unit con la última compra registrada ──
UPDATE public.raw_materials rm
SET cost_per_unit = COALESCE(
  (
    SELECT rme.unit_cost
    FROM public.raw_material_entries rme
    WHERE rme.raw_material_id = rm.id
    ORDER BY rme.entry_date DESC, rme.created_at DESC
    LIMIT 1
  ),
  rm.cost_per_unit,
  0
)
WHERE rm.cost_per_unit = 0;

-- ── 4. Trigger para auto-actualizar cost_per_unit al registrar compra ──
CREATE OR REPLACE FUNCTION trg_sync_material_cost_per_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.unit_cost IS NOT NULL AND NEW.unit_cost > 0 THEN
    UPDATE public.raw_materials
    SET cost_per_unit = NEW.unit_cost,
        updated_at = now()
    WHERE id = NEW.raw_material_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_material_cost ON public.raw_material_entries;
CREATE TRIGGER trg_update_material_cost
  AFTER INSERT OR UPDATE OF unit_cost ON public.raw_material_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_material_cost_per_unit();

-- ── 5. RPC para actualizar configuración de empresa por Admin ───
CREATE OR REPLACE FUNCTION admin_update_company_profitability(
  p_company_id UUID,
  p_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden cambiar la configuración de rentabilidad';
  END IF;

  UPDATE public.companies
  SET profitability_enabled = p_enabled
  WHERE id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_company_profitability(UUID, BOOLEAN) TO authenticated;
