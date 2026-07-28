-- ============================================================
-- Migration: delivery_zones
-- Tabla global para configurar zonas de domicilio con precios
-- y polígonos geográficos (Pereira, Dosquebradas, Cerritos).
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_zones (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  price      numeric     NOT NULL DEFAULT 0,
  polygon    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  color      text        NOT NULL DEFAULT '#8B5CF6',
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas de zonas activas
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones (is_active);

-- RLS -------------------------------------------------------
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Lectura: todo usuario autenticado
CREATE POLICY "delivery_zones_select"
  ON delivery_zones FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo administradores
CREATE POLICY "delivery_zones_insert"
  ON delivery_zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "delivery_zones_update"
  ON delivery_zones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "delivery_zones_delete"
  ON delivery_zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
