-- ============================================================================
-- Migration 15: Inventory System — Bodega General y Gestión de Recetas
-- Re-executable (idempotent): uses IF NOT EXISTS, CREATE OR REPLACE
-- ============================================================================

-- ── 0. TABLA: raw_material_categories ──────────────────────────────────────
-- Categorías de materia prima (Bebidas, Salsas, Empaques, etc.)
CREATE TABLE IF NOT EXISTS public.raw_material_categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id   UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',             -- color hex para UI
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_raw_material_categories_store
  ON public.raw_material_categories(store_id);

COMMENT ON TABLE public.raw_material_categories
  IS 'Categorías de materia prima por tienda (Bebidas, Empaques, Salsas, etc.)';

-- RLS para categorías
ALTER TABLE public.raw_material_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_categories' AND policyname = 'rmc_select') THEN
    CREATE POLICY rmc_select ON public.raw_material_categories
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_categories' AND policyname = 'rmc_insert') THEN
    CREATE POLICY rmc_insert ON public.raw_material_categories
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_categories' AND policyname = 'rmc_update') THEN
    CREATE POLICY rmc_update ON public.raw_material_categories
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_categories' AND policyname = 'rmc_delete') THEN
    CREATE POLICY rmc_delete ON public.raw_material_categories
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ── 1. TABLA: raw_materials ─────────────────────────────────────────────────
-- Catálogo de materia prima por tienda
CREATE TABLE IF NOT EXISTS public.raw_materials (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES public.raw_material_categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL,                          -- g, ml, unidad, lb, oz
  min_stock     NUMERIC(12,4) NOT NULL DEFAULT 0,      -- umbral de alerta
  current_stock NUMERIC(12,4) NOT NULL DEFAULT 0,      -- puede ser negativo
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_raw_materials_store_id
  ON public.raw_materials(store_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_category
  ON public.raw_materials(category_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_low_stock
  ON public.raw_materials(store_id, current_stock)
  WHERE is_active = true;

-- Columna category_id en caso de que la migración se re-ejecute sobre tabla existente
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raw_materials' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.raw_materials
      ADD COLUMN category_id UUID REFERENCES public.raw_material_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE public.raw_materials
  IS 'Catálogo de materia prima / insumos por tienda';

-- ── 2. TABLA: raw_material_entries ──────────────────────────────────────────
-- Registro de compras / entradas de inventario
CREATE TABLE IF NOT EXISTS public.raw_material_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity        NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  unit_cost       NUMERIC(12,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost      NUMERIC(12,4) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name   TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_material_entries_material
  ON public.raw_material_entries(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_raw_material_entries_date
  ON public.raw_material_entries(entry_date DESC);

COMMENT ON TABLE public.raw_material_entries
  IS 'Registro de entradas/compras de materia prima con costo';

-- ── 3. TABLA: recipes ───────────────────────────────────────────────────────
-- Recetas: qué materia prima consume cada producto (globales, no por tienda)
CREATE TABLE IF NOT EXISTS public.recipes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  raw_material_id   UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_required NUMERIC(12,4) NOT NULL CHECK (quantity_required > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, raw_material_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_product
  ON public.recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_material
  ON public.recipes(raw_material_id);

COMMENT ON TABLE public.recipes
  IS 'Relación producto → materia prima con cantidad requerida por unidad vendida';

-- ── 4. TABLA: stock_movements ───────────────────────────────────────────────
-- Trazabilidad completa de movimientos de stock
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id   UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  order_id          UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  entry_id          UUID REFERENCES public.raw_material_entries(id) ON DELETE SET NULL,
  quantity          NUMERIC(12,4) NOT NULL,              -- positivo = entrada, negativo = salida
  movement_type     TEXT NOT NULL CHECK (movement_type IN (
                      'order_deduction',    -- descuento automático por pedido
                      'entry',              -- entrada de inventario
                      'manual_adjustment'   -- ajuste manual
                    )),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_material
  ON public.stock_movements(raw_material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order
  ON public.stock_movements(order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON TABLE public.stock_movements
  IS 'Historial de movimientos de stock para trazabilidad completa';

-- ── 5. TRIGGER: auto-incrementar stock al registrar entrada ─────────────────
CREATE OR REPLACE FUNCTION trg_update_stock_on_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sumar al current_stock del material
  UPDATE raw_materials
  SET current_stock = current_stock + NEW.quantity,
      updated_at = now()
  WHERE id = NEW.raw_material_id;

  -- Registrar movimiento de entrada
  INSERT INTO stock_movements (raw_material_id, entry_id, quantity, movement_type, notes)
  VALUES (NEW.raw_material_id, NEW.id, NEW.quantity, 'entry', NEW.notes);

  RETURN NEW;
END;
$$;

-- Eliminar trigger existente antes de recrear (idempotencia)
DROP TRIGGER IF EXISTS trg_entry_stock_update ON public.raw_material_entries;
CREATE TRIGGER trg_entry_stock_update
  AFTER INSERT ON public.raw_material_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_stock_on_entry();

-- ── 6. RPC: deduct_stock_from_order ─────────────────────────────────────────
-- Descuenta materia prima basado en recetas al procesar un pedido.
-- IDEMPOTENTE: si ya se descontó para este order_id, no hace nada.
-- PERMITE STOCK NEGATIVO: nunca bloquea la venta.
CREATE OR REPLACE FUNCTION deduct_stock_from_order(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order       RECORD;
  v_deduction   RECORD;
  v_total_items INTEGER := 0;
  v_items_with_recipe INTEGER := 0;
  v_total_mats  INTEGER := 0;
  v_updated_stock NUMERIC;
  v_low_stock_alerts JSONB := '[]'::jsonb;
BEGIN
  -- 1. Validar que el pedido existe
  SELECT id, status, store_id
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN
    -- Pedido no encontrado: retornar sin error para no romper el flujo
    RETURN jsonb_build_object(
      'status',  'skipped',
      'message', format('Pedido %s no encontrado', p_order_id)
    );
  END IF;

  -- 2. Idempotencia: si ya hay movimientos para este pedido, salir sin error
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE order_id = p_order_id AND movement_type = 'order_deduction'
  ) THEN
    RETURN jsonb_build_object(
      'status',  'already_processed',
      'message', 'El stock ya fue descontado para este pedido'
    );
  END IF;

  -- 3. Contar total de items del pedido
  SELECT COUNT(*) INTO v_total_items
  FROM order_items
  WHERE order_id = p_order_id;

  -- 4. Contar cuántos items tienen receta asociada
  SELECT COUNT(DISTINCT oi.product_id) INTO v_items_with_recipe
  FROM order_items oi
  JOIN recipes r ON r.product_id = oi.product_id
  WHERE oi.order_id = p_order_id;

  -- 5. Calcular consumo total agrupado por materia prima
  --    INNER JOIN: productos SIN receta se saltan silenciosamente.
  --    Esto es intencional — no todos los productos tienen receta y eso es OK.
  FOR v_deduction IN
    SELECT
      r.raw_material_id,
      rm.name AS material_name,
      SUM(r.quantity_required * oi.quantity) AS total_to_deduct
    FROM order_items oi
    JOIN recipes r ON r.product_id = oi.product_id
    JOIN raw_materials rm ON rm.id = r.raw_material_id
                          AND rm.store_id = v_order.store_id
    WHERE oi.order_id = p_order_id
    GROUP BY r.raw_material_id, rm.name
  LOOP
    -- 5a. Descontar del stock (permite negativo) y obtener el nuevo valor
    UPDATE raw_materials
    SET current_stock = current_stock - v_deduction.total_to_deduct,
        updated_at = now()
    WHERE id = v_deduction.raw_material_id
    RETURNING current_stock INTO v_updated_stock;

    -- Registrar alerta si cae por debajo de 0
    IF v_updated_stock < 0 THEN
      v_low_stock_alerts := v_low_stock_alerts || to_jsonb(v_deduction.material_name);
    END IF;

    -- 5b. Registrar movimiento para trazabilidad
    INSERT INTO stock_movements (
      raw_material_id, order_id, quantity, movement_type, notes
    ) VALUES (
      v_deduction.raw_material_id,
      p_order_id,
      -v_deduction.total_to_deduct,  -- negativo = salida
      'order_deduction',
      format('Pedido %s: -%s de %s',
        p_order_id::TEXT,
        v_deduction.total_to_deduct::TEXT,
        v_deduction.material_name
      )
    );

    v_total_mats := v_total_mats + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status',               'success',
    'order_id',             p_order_id,
    'items_in_order',       v_total_items,
    'items_with_recipe',    v_items_with_recipe,
    'items_without_recipe', v_total_items - v_items_with_recipe,
    'materials_deducted',   v_total_mats,
    'low_stock_alerts',     v_low_stock_alerts
  );
END;
$$;

COMMENT ON FUNCTION deduct_stock_from_order(UUID)
  IS 'Descuenta materia prima del inventario basado en recetas. Idempotente y permite stock negativo.';

-- ── 7. RLS ──────────────────────────────────────────────────────────────────

-- raw_materials
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_materials' AND policyname = 'raw_materials_select_authenticated') THEN
    CREATE POLICY "raw_materials_select_authenticated"
      ON public.raw_materials FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_materials' AND policyname = 'raw_materials_all_admin') THEN
    CREATE POLICY "raw_materials_all_admin"
      ON public.raw_materials FOR ALL
      TO authenticated
      USING (public.auth_user_role() = 'admin')
      WITH CHECK (public.auth_user_role() = 'admin');
  END IF;
END $$;

-- raw_material_entries
ALTER TABLE public.raw_material_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_entries' AND policyname = 'entries_select_authenticated') THEN
    CREATE POLICY "entries_select_authenticated"
      ON public.raw_material_entries FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_entries' AND policyname = 'entries_all_admin') THEN
    CREATE POLICY "entries_all_admin"
      ON public.raw_material_entries FOR ALL
      TO authenticated
      USING (public.auth_user_role() = 'admin')
      WITH CHECK (public.auth_user_role() = 'admin');
  END IF;
END $$;

-- recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recipes' AND policyname = 'recipes_select_authenticated') THEN
    CREATE POLICY "recipes_select_authenticated"
      ON public.recipes FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recipes' AND policyname = 'recipes_all_admin') THEN
    CREATE POLICY "recipes_all_admin"
      ON public.recipes FOR ALL
      TO authenticated
      USING (public.auth_user_role() = 'admin')
      WITH CHECK (public.auth_user_role() = 'admin');
  END IF;
END $$;

-- stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'movements_select_authenticated') THEN
    CREATE POLICY "movements_select_authenticated"
      ON public.stock_movements FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'movements_all_admin') THEN
    CREATE POLICY "movements_all_admin"
      ON public.stock_movements FOR ALL
      TO authenticated
      USING (public.auth_user_role() = 'admin')
      WITH CHECK (public.auth_user_role() = 'admin');
  END IF;
END $$;

-- ── 8. Grants ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION deduct_stock_from_order(UUID) TO authenticated;
