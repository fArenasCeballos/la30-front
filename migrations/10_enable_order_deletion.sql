-- ============================================================
-- SCRIPT 10: Habilitar eliminación de pedidos (con cascade)
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Asegurar cascade delete para order_items
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
  ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE;

-- 2. Asegurar cascade delete para payments
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_order_id_fkey,
  ADD CONSTRAINT payments_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE;

-- 3. Crear política de DELETE para admin en orders
DROP POLICY IF EXISTS "orders: eliminar" ON orders;
CREATE POLICY "orders: eliminar" ON orders FOR DELETE TO authenticated
  USING (auth_user_role() = 'admin');
