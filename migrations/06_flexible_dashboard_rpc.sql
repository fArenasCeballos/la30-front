-- ============================================================
-- SCRIPT 6: RPC Flexible para Dashboard (Evitar desincronización)
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_store_id    UUID DEFAULT NULL,
  p_shift_start TIMESTAMPTZ DEFAULT NULL
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
