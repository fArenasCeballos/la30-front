-- ============================================================
-- LIMPIEZA AUTOMÁTICA DE REGISTROS ANTIGUOS
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================

-- ── Función de limpieza ──────────────────────────────────────
-- Elimina notificaciones y logs de estado de turnos anteriores.
-- Conserva registros de las últimas 24 horas para no afectar
-- el turno operativo actual.
--
-- Tablas que se limpian:
--   • notifications    → se acumulan exponencialmente (por cada 
--                         cambio de estado × cada usuario del rol)
--   • order_status_log → log de auditoría que crece con cada transición
--
-- Tablas que NO se limpian (necesarias para reportería):
--   • orders, order_items, payments, cash_register_closings
--
-- Llamada desde el frontend: supabase.rpc('cleanup_old_records')
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_role    user_role;
  v_cutoff       TIMESTAMPTZ;
  v_notif_count  BIGINT;
  v_log_count    BIGINT;
BEGIN
  -- Solo admin puede ejecutar la limpieza
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede ejecutar la limpieza de registros';
  END IF;

  -- Conservar registros de las últimas 24 horas
  v_cutoff := now() - INTERVAL '24 hours';

  -- 1. Limpiar notificaciones antiguas (leídas o no)
  DELETE FROM notifications WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_notif_count = ROW_COUNT;

  -- 2. Limpiar logs de estado antiguos
  DELETE FROM order_status_log WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_log_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'notifications_deleted', v_notif_count,
    'status_logs_deleted',   v_log_count,
    'cutoff',                v_cutoff
  );
END;
$$;
