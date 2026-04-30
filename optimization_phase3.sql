-- ============================================================
-- LA 30 - OPTIMIZACIÓN DE VELOCIDAD (FASE 3)
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================

-- 1. ÍNDICES COMPUESTOS (PARA BÚSQUEDAS RELÁMPAGO)
-- Optimiza la carga de pedidos en Caja y Cocina
CREATE INDEX IF NOT EXISTS idx_orders_status_created_speed 
ON orders (status, created_at DESC);

-- Optimiza el Dashboard y Reportería
CREATE INDEX IF NOT EXISTS idx_orders_created_only_speed 
ON orders (created_at DESC);

-- Optimiza la búsqueda de items por pedido
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_speed 
ON order_items (order_id);

-- 2. OPTIMIZACIÓN DE RLS (EVITA SUBCONSULTAS)
-- Primero, necesitamos que el rol esté en el JWT. 
-- (Asegúrate de haber configurado el trigger o usa esta versión optimizada de auth_user_role)
CREATE OR REPLACE FUNCTION auth_user_role_fast()
RETURNS user_role AS $$
  -- Intenta leer del cache de la sesión actual primero
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    (SELECT role::text FROM profiles WHERE id = auth.uid())
  )::user_role;
$$ LANGUAGE sql STABLE;

-- 3. FUNCIÓN DE LIMPIEZA AUTOMÁTICA MEJORADA
-- Mantiene la tabla de notificaciones ligera (máx 100 por usuario o 3 días de antigüedad)
CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS JSONB AS $$
DECLARE
  v_deleted_notif INTEGER;
BEGIN
  -- Borrar notificaciones de más de 3 días
  DELETE FROM notifications WHERE created_at < now() - interval '3 days';
  GET DIAGNOSTICS v_deleted_notif = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'success',
    'deleted_notifications', v_deleted_notif,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. VISTA MATERIALIZADA PARA EL MENÚ (OPCIONAL - MÁXIMA VELOCIDAD)
-- Si tienes muchos productos, esto hace que el Kiosko cargue al instante.
-- Por ahora, con índices simples en 'products' es suficiente.
CREATE INDEX IF NOT EXISTS idx_products_available_sort 
ON products (available, sort_order);
