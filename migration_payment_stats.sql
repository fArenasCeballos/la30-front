-- ============================================================
-- MIGRACIÓN: Desglose de métodos de pago en get_dashboard_stats()
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- 
-- LÓGICA:
-- - Para pagos NO mixtos: usar method + amount_total (el total real del pedido)
-- - Para pagos MIXTOS: usar amount_efectivo, amount_tarjeta, amount_nequi
--   (representan cómo se dividió el total entre métodos)
-- - Solo contar pagos de pedidos ENTREGADOS
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift_start  TIMESTAMPTZ;
  v_revenue      INTEGER;
  v_active       INTEGER;
  v_completed    INTEGER;
  v_cancelled    INTEGER;
  v_avg_ticket   INTEGER;
  v_cash         INTEGER;
  v_card         INTEGER;
  v_nequi        INTEGER;
BEGIN
  v_shift_start := get_shift_start();

  SELECT
    COALESCE(SUM(total) FILTER (WHERE status = 'entregado'), 0),
    COUNT(*) FILTER (WHERE status IN ('pendiente','confirmado','en_preparacion','listo')),
    COUNT(*) FILTER (WHERE status = 'entregado'),
    COUNT(*) FILTER (WHERE status = 'cancelado')
  INTO v_revenue, v_active, v_completed, v_cancelled
  FROM orders
  WHERE created_at >= v_shift_start;

  v_avg_ticket := CASE WHEN v_completed > 0 THEN v_revenue / v_completed ELSE 0 END;

  -- Desglose por método de pago
  -- NO mixto: method indica el método → amount_total es el monto real
  -- Mixto: los sub-montos indican cómo se dividió el total
  SELECT
    COALESCE(SUM(
      CASE
        WHEN p.method = 'mixto' THEN COALESCE(p.amount_efectivo, 0)
        WHEN p.method = 'efectivo' THEN p.amount_total
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE
        WHEN p.method = 'mixto' THEN COALESCE(p.amount_tarjeta, 0)
        WHEN p.method = 'tarjeta' THEN p.amount_total
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE
        WHEN p.method = 'mixto' THEN COALESCE(p.amount_nequi, 0)
        WHEN p.method = 'nequi' THEN p.amount_total
        ELSE 0
      END
    ), 0)
  INTO v_cash, v_card, v_nequi
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  WHERE p.created_at >= v_shift_start
    AND o.status = 'entregado';

  RETURN jsonb_build_object(
    'total_revenue',   v_revenue,
    'active_orders',   v_active,
    'completed_today', v_completed,
    'cancelled_today', v_cancelled,
    'avg_ticket',      v_avg_ticket,
    'cash_total',      v_cash,
    'card_total',      v_card,
    'nequi_total',     v_nequi
  );
END;
$$;
