-- ============================================================
-- SCRIPT 5: Corregir horario de turno para Dashboard (4 PM Local)
-- ============================================================
-- El servidor está en UTC. Para GMT-5 (Colombia), las 4 PM son las 21:00 UTC.
-- ============================================================

-- ── 1. get_dashboard_stats: Ajuste a 21:00 UTC ────────────────
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_store_id UUID DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result        JSON;
  v_shift_start   TIMESTAMPTZ;
  v_resolved_store UUID;
BEGIN
  -- Resolver tienda
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

  -- Turno: desde las 4pm local (21:00 UTC)
  v_shift_start := date_trunc('day', now()) + INTERVAL '21 hours';
  IF now() < v_shift_start THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  SELECT json_build_object(
    'total_revenue',   COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    'active_orders',   COUNT(*) FILTER (WHERE status NOT IN ('entregado','cancelado')),
    'completed_today', COUNT(*) FILTER (WHERE status = 'entregado'),
    'cancelled_today', COUNT(*) FILTER (WHERE status = 'cancelado'),
    'avg_ticket',      COALESCE(
                         AVG(total) FILTER (WHERE status = 'entregado'),
                         0
                       ),
    'cash_total',      COALESCE((
                         SELECT SUM(CASE
                           WHEN p.method = 'efectivo' THEN p.amount_total
                           WHEN p.method = 'mixto' THEN p.amount_efectivo
                           ELSE 0 END)
                         FROM payments p
                         JOIN orders o ON o.id = p.order_id
                         WHERE o.created_at >= v_shift_start
                           AND o.status = 'entregado'
                           AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
                       ), 0),
    'card_total',      COALESCE((
                         SELECT SUM(CASE
                           WHEN p.method = 'tarjeta' THEN p.amount_total
                           WHEN p.method = 'mixto' THEN p.amount_tarjeta
                           ELSE 0 END)
                         FROM payments p
                         JOIN orders o ON o.id = p.order_id
                         WHERE o.created_at >= v_shift_start
                           AND o.status = 'entregado'
                           AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
                       ), 0),
    'nequi_total',     COALESCE((
                         SELECT SUM(CASE
                           WHEN p.method = 'nequi' THEN p.amount_total
                           WHEN p.method = 'mixto' THEN p.amount_nequi
                           ELSE 0 END)
                         FROM payments p
                         JOIN orders o ON o.id = p.order_id
                         WHERE o.created_at >= v_shift_start
                           AND o.status = 'entregado'
                           AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
                       ), 0)
  ) INTO v_result
  FROM orders
  WHERE created_at >= v_shift_start
    AND (v_resolved_store IS NULL OR store_id = v_resolved_store);

  RETURN v_result;
END;
$$;

-- ── 2. get_top_products: Ajuste a 21:00 UTC ───────────────────
CREATE OR REPLACE FUNCTION get_top_products(
  p_limit    INTEGER DEFAULT 6,
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE(product_name TEXT, category TEXT, quantity BIGINT, revenue BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift_start    TIMESTAMPTZ;
  v_resolved_store UUID;
BEGIN
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT prof.store_id FROM profiles prof WHERE prof.id = auth.uid())
  );

  v_shift_start := date_trunc('day', now()) + INTERVAL '21 hours';
  IF now() < v_shift_start THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

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
