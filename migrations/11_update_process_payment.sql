-- ============================================================
-- SCRIPT 11: Permitir cobros en pedidos listos (Domicilios)
-- ============================================================

-- Eliminar las funciones anteriores para evitar colisión de firmas (overloading)
DROP FUNCTION IF EXISTS process_payment(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS process_payment(UUID, public.payment_method, INTEGER, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION process_payment(
  p_order_id        UUID,
  p_method          public.payment_method,
  p_amount_received INTEGER,
  p_amt_efectivo    INTEGER DEFAULT 0,
  p_amt_tarjeta     INTEGER DEFAULT 0,
  p_amt_nequi       INTEGER DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      RECORD;
  v_payment_id UUID;
  v_change     INTEGER;
BEGIN
  -- Validar permisos de cajero o admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'caja') AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Sin permisos para procesar pagos';
  END IF;

  -- Obtener el pedido
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- Validar estado del pedido: permitir cobro en 'confirmado', 'en_preparacion' y 'listo'
  IF v_order.status NOT IN ('confirmado', 'en_preparacion', 'listo') THEN
    RAISE EXCEPTION 'El pedido debe estar confirmado para cobrar (estado actual: %)', v_order.status;
  END IF;

  -- Calcular el cambio
  v_change := p_amount_received - v_order.total;
  IF v_change < 0 THEN
    v_change := 0;
  END IF;

  -- Registrar el pago
  INSERT INTO payments (
    order_id,
    method,
    amount_total,
    amount_received,
    amount_change,
    amount_efectivo,
    amount_tarjeta,
    amount_nequi,
    processed_by
  ) VALUES (
    p_order_id,
    p_method,
    v_order.total,
    p_amount_received,
    v_change,
    p_amt_efectivo,
    p_amt_tarjeta,
    p_amt_nequi,
    auth.uid()
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'payment_id', v_payment_id,
    'change', v_change
  );
END;
$$;
