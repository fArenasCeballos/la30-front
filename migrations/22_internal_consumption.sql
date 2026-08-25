-- ============================================================================
-- Migración 22: Módulo de Consumo Interno
-- Registro de pedidos internos (empleados y socios) con descuento del 50%
-- ============================================================================

-- ── 1. Tabla de Socios Internos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.internal_partners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  document_id TEXT,
  phone       TEXT,
  email       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_partners_active
  ON public.internal_partners(is_active);

COMMENT ON TABLE public.internal_partners IS
  'Socios del restaurante que acceden a consumo interno con descuento';

ALTER TABLE public.internal_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_partners_admin_caja" ON public.internal_partners;
CREATE POLICY "internal_partners_admin_caja" ON public.internal_partners
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  );


-- ── 2. Tabla de Consumos Internos (Cabecera) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.internal_consumptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES public.stores(id),
  consumer_type   TEXT NOT NULL CHECK (consumer_type IN ('employee', 'partner')),
  employee_id     UUID REFERENCES public.profiles(id),
  partner_id      UUID REFERENCES public.internal_partners(id),
  consumer_name   TEXT NOT NULL,
  total_original  INTEGER NOT NULL DEFAULT 0,
  discount_total  INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  payment_method  TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ,

  CONSTRAINT chk_consumer_ref CHECK (
    (consumer_type = 'employee' AND employee_id IS NOT NULL) OR
    (consumer_type = 'partner'  AND partner_id  IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_internal_consumptions_store
  ON public.internal_consumptions(store_id);
CREATE INDEX IF NOT EXISTS idx_internal_consumptions_employee
  ON public.internal_consumptions(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_consumptions_partner
  ON public.internal_consumptions(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_consumptions_status
  ON public.internal_consumptions(payment_status);
CREATE INDEX IF NOT EXISTS idx_internal_consumptions_created
  ON public.internal_consumptions(created_at DESC);

COMMENT ON TABLE public.internal_consumptions IS
  'Pedidos de consumo interno de empleados y socios con descuento del 50% (no factura DIAN)';

ALTER TABLE public.internal_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_consumptions_admin_caja" ON public.internal_consumptions;
CREATE POLICY "internal_consumptions_admin_caja" ON public.internal_consumptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  );


-- ── 3. Tabla de Ítems de Consumo Interno ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.internal_consumption_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_id   UUID NOT NULL REFERENCES public.internal_consumptions(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES public.products(id),
  product_name     TEXT NOT NULL,
  category_name    TEXT,
  is_beverage      BOOLEAN NOT NULL DEFAULT FALSE,
  quantity         INTEGER NOT NULL DEFAULT 1,
  original_price   INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  unit_price       INTEGER NOT NULL,
  subtotal         INTEGER NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_consumption_items_consumption
  ON public.internal_consumption_items(consumption_id);

COMMENT ON TABLE public.internal_consumption_items IS
  'Detalle de productos en cada consumo interno, incluye flag de bebida y descuento aplicado';

ALTER TABLE public.internal_consumption_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_consumption_items_admin_caja" ON public.internal_consumption_items;
CREATE POLICY "internal_consumption_items_admin_caja" ON public.internal_consumption_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  );


-- ── 4. Tabla de Pagos / Abonos de Consumo Interno ────────────────────────────
CREATE TABLE IF NOT EXISTS public.internal_consumption_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_id  UUID REFERENCES public.internal_consumptions(id) ON DELETE CASCADE,
  consumer_type   TEXT NOT NULL CHECK (consumer_type IN ('employee', 'partner')),
  employee_id     UUID REFERENCES public.profiles(id),
  partner_id      UUID REFERENCES public.internal_partners(id),
  amount          INTEGER NOT NULL,
  payment_method  TEXT NOT NULL,
  notes           TEXT,
  recorded_by     UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_consumption_payments_consumption
  ON public.internal_consumption_payments(consumption_id) WHERE consumption_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_consumption_payments_employee
  ON public.internal_consumption_payments(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_internal_consumption_payments_partner
  ON public.internal_consumption_payments(partner_id) WHERE partner_id IS NOT NULL;

COMMENT ON TABLE public.internal_consumption_payments IS
  'Abonos y pagos registrados contra consumos internos para liquidación de cuentas de cobro';

ALTER TABLE public.internal_consumption_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_consumption_payments_admin_caja" ON public.internal_consumption_payments;
CREATE POLICY "internal_consumption_payments_admin_caja" ON public.internal_consumption_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'caja')
        AND profiles.is_active = TRUE
    )
  );


-- ── 5. Permisos de tabla para el rol authenticated ───────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_partners            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_consumptions        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_consumption_items   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_consumption_payments TO authenticated;
