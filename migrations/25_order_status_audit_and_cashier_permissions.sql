-- ============================================================================
-- Migración 25: Auditoría de Cambios de Estado de Pedidos y Permisos de Cajero
-- Permite que los cajeros cambien estados de pedidos con registro estricto en log
-- y notificación en tiempo real a los administradores de la empresa.
-- ============================================================================

-- ── 1. Tabla de Historial de Auditoría de Estados ────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID         NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status  order_status NOT NULL,
  new_status       order_status NOT NULL,
  changed_by       UUID         NOT NULL REFERENCES public.profiles(id),
  changed_by_name  TEXT,
  changed_by_role  user_role,
  reason           TEXT,
  store_id         UUID         REFERENCES public.stores(id),
  company_id       UUID         REFERENCES public.companies(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.order_status_logs IS 'Bitácora de auditoría inmutable de cambios de estado de órdenes de venta, exclusiva para administradores.';
COMMENT ON COLUMN public.order_status_logs.reason IS 'Motivo o justificación documentada por el cajero o administrador al modificar el estado.';

-- ── Índices para búsqueda rápida por turno, orden y sede ─────────────────────
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON public.order_status_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_created_at ON public.order_status_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_store_id ON public.order_status_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_company_id ON public.order_status_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_changed_by ON public.order_status_logs(changed_by);

-- ── 2. Políticas de Seguridad RLS (Row Level Security) ───────────────────────
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

-- Exclusivo para administradores: ningún cajero ni mesero puede consultar la bitácora
DROP POLICY IF EXISTS "order_status_logs: solo admin puede ver" ON public.order_status_logs;
CREATE POLICY "order_status_logs: solo admin puede ver"
  ON public.order_status_logs
  FOR SELECT
  TO authenticated
  USING (auth_user_role() = 'admin');

-- Permitir a usuarios autenticados insertar su propio registro
DROP POLICY IF EXISTS "order_status_logs: insertar registro" ON public.order_status_logs;
CREATE POLICY "order_status_logs: insertar registro"
  ON public.order_status_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- ── 3. Función RPC Mejorada: update_order_status ─────────────────────────────
-- Se sobreescribe para aceptar p_reason, permitir rol caja y generar logs + notificaciones
DROP FUNCTION IF EXISTS public.update_order_status(UUID, order_status);
DROP FUNCTION IF EXISTS public.update_order_status(UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_order_status(UUID, order_status, TEXT);
DROP FUNCTION IF EXISTS public.update_order_status(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_status   order_status,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order         RECORD;
  v_user_role     user_role;
  v_user_name     TEXT;
  v_store_name    TEXT;
  v_company_id    UUID;
  v_store_id      UUID;
  v_allowed       BOOLEAN := FALSE;
  v_admin_record  RECORD;
  v_log_id        UUID;
BEGIN
  -- 1. Validar usuario autenticado y activo
  SELECT role, name INTO v_user_role, v_user_name
  FROM profiles
  WHERE id = auth.uid() AND is_active = TRUE;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado o inactivo';
  END IF;

  -- 2. Validar existencia del pedido
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  -- 3. Obtener tienda y empresa asociadas
  v_store_id := v_order.store_id;
  SELECT name, company_id INTO v_store_name, v_company_id
  FROM stores
  WHERE id = v_store_id;

  -- 4. Si el pedido ya tiene ese estado, evitar registrar logs duplicados
  IF v_order.status = p_status THEN
    RETURN jsonb_build_object(
      'order_id',        p_order_id,
      'locator',         v_order.locator,
      'previous_status', v_order.status,
      'new_status',      p_status,
      'message',         'El pedido ya se encontraba en el estado solicitado'
    );
  END IF;

  -- 5. Validar permisos según el rol
  IF v_user_role = 'admin' THEN
    -- Administrador tiene control total
    v_allowed := TRUE;
  ELSIF v_user_role = 'caja' THEN
    -- Cajero tiene autorización para cambiar estados (control supervisado)
    v_allowed := TRUE;
  ELSIF v_user_role = 'cocina' THEN
    -- Cocina solo puede avanzar pedidos en su ciclo operativo
    IF p_status = 'en_preparacion' AND v_order.status = 'confirmado' THEN
      v_allowed := TRUE;
    ELSIF p_status = 'listo' AND v_order.status = 'en_preparacion' THEN
      v_allowed := TRUE;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transición no permitida: % → % (rol: %)',
      v_order.status, p_status, v_user_role;
  END IF;

  -- 6. Actualizar el estado del pedido
  UPDATE orders
  SET status = p_status,
      updated_at = now()
  WHERE id = p_order_id;

  -- 7. Registrar en bitácora de auditoría
  INSERT INTO public.order_status_logs (
    order_id,
    previous_status,
    new_status,
    changed_by,
    changed_by_name,
    changed_by_role,
    reason,
    store_id,
    company_id,
    created_at
  ) VALUES (
    p_order_id,
    v_order.status,
    p_status,
    auth.uid(),
    COALESCE(v_user_name, 'Usuario'),
    v_user_role,
    NULLIF(trim(p_reason), ''),
    v_store_id,
    v_company_id,
    now()
  )
  RETURNING id INTO v_log_id;

  -- 8. Notificar a los administradores en tiempo real si el cambio lo hizo un cajero
  IF v_user_role = 'caja' THEN
    FOR v_admin_record IN
      SELECT p.id AS admin_id
      FROM profiles p
      WHERE p.role = 'admin'
        AND p.is_active = TRUE
        AND (
          v_company_id IS NULL
          OR p.company_ids IS NULL
          OR (p.company_ids IS NOT NULL AND p.company_ids @> ARRAY[v_company_id])
        )
    LOOP
      INSERT INTO notifications (
        user_id,
        company_id,
        title,
        message,
        type,
        is_read,
        created_at
      ) VALUES (
        v_admin_record.admin_id,
        v_company_id,
        'Cambio de Estado por Cajero' || COALESCE(' [' || v_store_name || ']', ''),
        'El cajero ' || COALESCE(v_user_name, 'Caja') || ' cambió la orden #' || COALESCE(v_order.locator, substring(p_order_id::text, 1, 6)) || ' de "' || v_order.status || '" a "' || p_status || '".' || CASE WHEN p_reason IS NOT NULL AND trim(p_reason) != '' THEN ' Motivo: ' || trim(p_reason) ELSE '' END,
        'warning',
        FALSE,
        now()
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'order_id',        p_order_id,
    'locator',         v_order.locator,
    'previous_status', v_order.status,
    'new_status',      p_status,
    'log_id',          v_log_id
  );
END;
$$;

-- Privilegios de ejecución
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, order_status, TEXT) TO authenticated, service_role;
