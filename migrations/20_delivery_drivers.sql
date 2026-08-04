-- ============================================================
-- SCRIPT 20: Domiciliarios (Delivery Drivers)
-- Crea la tabla de domiciliarios y agrega el driver_id a los pedidos
-- ============================================================

-- 1. Crear tabla de domiciliarios
CREATE TABLE IF NOT EXISTS delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    motorcycle_plate TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Función y Trigger para updated_at en delivery_drivers
CREATE OR REPLACE FUNCTION set_delivery_drivers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_delivery_drivers_timestamp
BEFORE UPDATE ON delivery_drivers
FOR EACH ROW
EXECUTE FUNCTION set_delivery_drivers_updated_at();

-- 3. Modificar tabla de pedidos (orders) para relacionarlos con el domiciliario
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL;

-- 4. RLS para delivery_drivers
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;

-- Políticas para lectura (todos los usuarios autenticados pueden ver los activos o si son admin)
CREATE POLICY "Users can view delivery drivers"
    ON delivery_drivers FOR SELECT
    USING (auth.role() = 'authenticated');

-- Políticas para admin (pueden crear/actualizar/eliminar)
CREATE POLICY "Admins can insert delivery drivers"
    ON delivery_drivers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update delivery drivers"
    ON delivery_drivers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete delivery drivers"
    ON delivery_drivers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
