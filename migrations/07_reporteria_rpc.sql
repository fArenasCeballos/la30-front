-- ============================================================
-- SCRIPT 7: RPC para Reportería (Cálculos de lado del servidor)
-- ============================================================

CREATE OR REPLACE FUNCTION get_reporteria_stats(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_store_id UUID DEFAULT NULL,
  p_type_filter TEXT DEFAULT 'all'
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
  v_resolved_store UUID;
BEGIN
  -- Resolver tienda (si no se pasa p_store_id, se usa el de auth.uid)
  v_resolved_store := COALESCE(
    p_store_id,
    (SELECT store_id FROM profiles WHERE id = auth.uid())
  );

  SELECT json_build_object(
    'total_sales',      COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    'active_orders',    COUNT(*) FILTER (WHERE status IN ('pendiente', 'confirmado', 'en_preparacion', 'listo')),
    'completed_orders', COUNT(*) FILTER (WHERE status = 'entregado'),
    'cancelled_orders', COUNT(*) FILTER (WHERE status = 'cancelado'),
    'avg_ticket',       COALESCE(AVG(total) FILTER (WHERE status = 'entregado'), 0),
    
    'delivery_total',   COALESCE(SUM(total) FILTER (WHERE status = 'entregado' AND is_delivery = true), 0),
    'delivery_pending', COALESCE(SUM(total) FILTER (WHERE status IN ('pendiente', 'confirmado', 'en_preparacion', 'listo') AND is_delivery = true), 0),
    'caja_total',       COALESCE(SUM(total) FILTER (WHERE status = 'entregado' AND (is_delivery IS NULL OR is_delivery = false)), 0),
    
    'cash_total', COALESCE((
        SELECT SUM(CASE 
            WHEN p.method = 'efectivo' THEN p.amount_total 
            WHEN p.method = 'mixto' THEN COALESCE(p.amount_efectivo, 0)
            ELSE 0 END)
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),
    'card_total', COALESCE((
        SELECT SUM(CASE 
            WHEN p.method IN ('tarjeta', 'tarjeta_debito', 'tarjeta_credito') THEN p.amount_total 
            WHEN p.method = 'mixto' THEN COALESCE(p.amount_tarjeta, 0)
            ELSE 0 END)
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),
    'nequi_total', COALESCE((
        SELECT SUM(CASE 
            WHEN p.method IN ('nequi', 'daviplata') THEN p.amount_total 
            WHEN p.method = 'mixto' THEN COALESCE(p.amount_nequi, 0)
            ELSE 0 END)
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),
    'siesa_total', COALESCE((
        SELECT SUM(CASE WHEN p.method = 'siesa' THEN p.amount_total ELSE 0 END)
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),
    'transfer_total', COALESCE((
        SELECT SUM(CASE WHEN p.method = 'transferencia' THEN p.amount_total ELSE 0 END)
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),
    'pending_total', COALESCE((
        SELECT SUM(CASE WHEN p.method = 'pendiente' THEN p.amount_total ELSE 0 END)
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),
    
    'items_sold', COALESCE((
        SELECT SUM(oi.quantity)
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= p_start AND o.created_at <= p_end
          AND o.status = 'entregado'
          AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
          AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
    ), 0),

    'sales_by_day', COALESCE((
        SELECT json_agg(json_build_object('date', date_txt, 'ventas', sales))
        FROM (
            SELECT to_char(timezone('America/Bogota', created_at), 'DD/MM') as date_txt, SUM(total) as sales
            FROM orders
            WHERE created_at >= p_start AND created_at <= p_end
              AND status = 'entregado'
              AND (v_resolved_store IS NULL OR store_id = v_resolved_store)
              AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND is_delivery = true) OR (p_type_filter = 'caja' AND (is_delivery IS NULL OR is_delivery = false)))
            GROUP BY date_trunc('day', timezone('America/Bogota', created_at)), to_char(timezone('America/Bogota', created_at), 'DD/MM')
            ORDER BY date_trunc('day', timezone('America/Bogota', created_at))
        ) sub
    ), '[]'::json),

    'sales_by_hour', COALESCE((
        SELECT json_agg(json_build_object('hora', hour_txt, 'ventas', sales))
        FROM (
            SELECT to_char(timezone('America/Bogota', created_at), 'HH24:00') as hour_txt, SUM(total) as sales
            FROM orders
            WHERE created_at >= p_start AND created_at <= p_end
              AND status = 'entregado'
              AND (v_resolved_store IS NULL OR store_id = v_resolved_store)
              AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND is_delivery = true) OR (p_type_filter = 'caja' AND (is_delivery IS NULL OR is_delivery = false)))
            GROUP BY date_trunc('hour', timezone('America/Bogota', created_at)), to_char(timezone('America/Bogota', created_at), 'HH24:00')
            ORDER BY date_trunc('hour', timezone('America/Bogota', created_at))
        ) sub_hour
    ), '[]'::json),

    'top_products', COALESCE((
        SELECT json_agg(json_build_object('product_name', name, 'quantity', qty))
        FROM (
            SELECT pr.name, SUM(oi.quantity) as qty
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products pr ON pr.id = oi.product_id
            WHERE o.created_at >= p_start AND o.created_at <= p_end
              AND o.status = 'entregado'
              AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
              AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
            GROUP BY pr.id, pr.name
            ORDER BY qty DESC
            LIMIT 10
        ) sub2
    ), '[]'::json),

    'waiter_stats', COALESCE((
        SELECT json_agg(json_build_object('name', name, 'orders', orders_count, 'total', total_sales))
        FROM (
            SELECT COALESCE(pr.name, 'Sistema') as name, COUNT(*) as orders_count, SUM(o.total) as total_sales
            FROM orders o
            LEFT JOIN profiles pr ON pr.id = o.user_id
            WHERE o.created_at >= p_start AND o.created_at <= p_end
              AND o.status = 'entregado'
              AND (v_resolved_store IS NULL OR o.store_id = v_resolved_store)
              AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND o.is_delivery = true) OR (p_type_filter = 'caja' AND (o.is_delivery IS NULL OR o.is_delivery = false)))
            GROUP BY pr.id, pr.name
            ORDER BY total_sales DESC
        ) sub3
    ), '[]'::json)

  ) INTO v_result
  FROM orders
  WHERE created_at >= p_start AND created_at <= p_end
    AND (v_resolved_store IS NULL OR store_id = v_resolved_store)
    AND (p_type_filter = 'all' OR (p_type_filter = 'delivery' AND is_delivery = true) OR (p_type_filter = 'caja' AND (is_delivery IS NULL OR is_delivery = false)));

  RETURN v_result;
END;
$$;
