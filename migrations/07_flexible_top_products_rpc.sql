-- ============================================================
-- SCRIPT 7: RPC Flexible para Top Products
-- ============================================================

CREATE OR REPLACE FUNCTION get_top_products(
  p_limit        INTEGER DEFAULT 6,
  p_store_id     UUID DEFAULT NULL,
  p_shift_start  TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(product_name TEXT, category TEXT, quantity BIGINT, revenue BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift_start    TIMESTAMPTZ;
  v_resolved_store UUID;
BEGIN
  -- Resolver tienda
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT prof.store_id FROM profiles prof WHERE prof.id = auth.uid())
  );

  -- Usar el shift_start pasado o calcular el default (21:00 UTC = 4 PM Local)
  v_shift_start := COALESCE(
    p_shift_start,
    (
      CASE 
        WHEN now() < (date_trunc('day', now()) + INTERVAL '21 hours') 
        THEN date_trunc('day', now()) - INTERVAL '3 hours' -- Ayer 21:00 UTC
        ELSE date_trunc('day', now()) + INTERVAL '21 hours' -- Hoy 21:00 UTC
      END
    )
  );

  RETURN QUERY
  SELECT
    p.name                           AS product_name,
    COALESCE(c.name, 'Sin categoría') AS category,
    SUM(oi.quantity)                  AS quantity,
    SUM(oi.unit_price * oi.quantity)  AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE o.created_at >= v_shift_start
    AND o.status = 'entregado'
    AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
  GROUP BY p.name, c.name
  ORDER BY quantity DESC
  LIMIT COALESCE(p_limit, 6);
END;
$$;
