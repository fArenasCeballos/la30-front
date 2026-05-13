-- ============================================================
-- SCRIPT 5 FIX: Drop y recrear vistas + RLS
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- ============================================================


-- ── 0. Habilitar RLS en stores ───────────────────────────────
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Evitar duplicados de policies
DROP POLICY IF EXISTS "stores: ver" ON stores;
DROP POLICY IF EXISTS "stores: admin" ON stores;

CREATE POLICY "stores: ver" ON stores FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "stores: admin" ON stores FOR ALL TO authenticated USING (auth_user_role() = 'admin');


-- ── 1. Actualizar RLS de ORDERS ──────────────────────────────
DROP POLICY IF EXISTS "orders: ver" ON orders;

CREATE POLICY "orders: ver" ON orders FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'admin'
    OR store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
  );


-- ── 2. Actualizar RLS de CATEGORIES ─────────────────────────
DROP POLICY IF EXISTS "categories: ver" ON categories;

CREATE POLICY "categories: ver" ON categories FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'admin'
    OR store_ids @> ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
  );


-- ── 3. Actualizar RLS de PRODUCTS ────────────────────────────
DROP POLICY IF EXISTS "products: ver" ON products;

CREATE POLICY "products: ver" ON products FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'admin'
    OR store_ids @> ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
  );


-- ── 4. Actualizar RLS de PRODUCT_CUSTOM_OPTIONS ──────────────
DROP POLICY IF EXISTS "custom_options: ver" ON product_custom_options;

CREATE POLICY "custom_options: ver" ON product_custom_options FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'admin'
    OR store_ids @> ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
  );


-- ── 5. Actualizar RLS de PRODUCT_EXTRAS ──────────────────────
DROP POLICY IF EXISTS "extras: ver" ON product_extras;

CREATE POLICY "extras: ver" ON product_extras FOR SELECT TO authenticated
  USING (
    auth_user_role() = 'admin'
    OR store_ids @> ARRAY[(SELECT store_id FROM profiles WHERE id = auth.uid())]
  );


-- ── 6. Actualizar RLS de CASH_REGISTER_CLOSINGS ─────────────
DROP POLICY IF EXISTS "cash_closings: ver" ON cash_register_closings;

CREATE POLICY "cash_closings: ver" ON cash_register_closings FOR SELECT TO authenticated
  USING (
    auth_user_role() IN ('admin','caja')
    AND (
      auth_user_role() = 'admin'
      OR store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    )
  );


-- ── 7. DROP las vistas existentes y recrearlas ───────────────
DROP VIEW IF EXISTS v_daily_sales CASCADE;
DROP VIEW IF EXISTS v_hourly_sales CASCADE;
DROP VIEW IF EXISTS v_top_products CASCADE;
DROP VIEW IF EXISTS v_waiter_performance CASCADE;

CREATE VIEW v_daily_sales AS
SELECT
  DATE(o.created_at AT TIME ZONE 'America/Bogota') AS sale_date,
  o.store_id,
  COUNT(*)                                           AS total_orders,
  COUNT(*) FILTER (WHERE o.status = 'entregado')     AS delivered_orders,
  COUNT(*) FILTER (WHERE o.status = 'cancelado')     AS cancelled_orders,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'), 0) AS total_revenue,
  COALESCE(AVG(o.total) FILTER (WHERE o.status = 'entregado'), 0)::INTEGER AS avg_ticket
FROM orders o
GROUP BY DATE(o.created_at AT TIME ZONE 'America/Bogota'), o.store_id
ORDER BY sale_date DESC;

CREATE VIEW v_hourly_sales AS
SELECT
  DATE(o.created_at AT TIME ZONE 'America/Bogota')                        AS sale_date,
  EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'America/Bogota')::INTEGER  AS hour,
  o.store_id,
  COUNT(*)                                                                  AS order_count,
  COALESCE(SUM(o.total), 0)                                                AS total_revenue
FROM orders o
WHERE o.status != 'cancelado'
GROUP BY sale_date, hour, o.store_id
ORDER BY sale_date DESC, hour;

CREATE VIEW v_top_products AS
SELECT
  p.id,
  p.name,
  c.label AS category,
  o.store_id,
  SUM(oi.quantity)                AS total_quantity,
  SUM(oi.unit_price * oi.quantity) AS total_revenue
FROM order_items oi
JOIN products   p ON p.id = oi.product_id
JOIN categories c ON c.id = p.category_id
JOIN orders     o ON o.id = oi.order_id
WHERE o.status != 'cancelado'
GROUP BY p.id, p.name, c.label, o.store_id
ORDER BY total_quantity DESC;

CREATE VIEW v_waiter_performance AS
SELECT
  pr.id          AS user_id,
  pr.name        AS waiter_name,
  pr.store_id,
  COUNT(o.id)    AS total_orders,
  COALESCE(SUM(o.total),                                        0) AS total_revenue,
  COALESCE(SUM(o.total) FILTER (WHERE o.status = 'entregado'), 0) AS delivered_revenue,
  COUNT(*)       FILTER (WHERE o.status = 'cancelado')              AS cancelled_orders
FROM profiles pr
LEFT JOIN orders o ON o.created_by = pr.id
WHERE pr.role = 'mesero'
GROUP BY pr.id, pr.name, pr.store_id
ORDER BY delivered_revenue DESC;


-- ── 8. Verificar ─────────────────────────────────────────────
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('stores', 'orders', 'categories', 'products',
                    'product_custom_options', 'product_extras', 'cash_register_closings')
ORDER BY tablename, policyname;
