-- ============================================================
-- SCRIPT 19: Acceso multi-tienda por usuario
-- Agrega allowed_store_ids a profiles para controlar a qué
-- tiendas puede acceder cada colaborador.
-- ============================================================

-- 1. Agregar columna allowed_store_ids al tabla profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allowed_store_ids UUID[] DEFAULT NULL;

-- 2. Índice GIN para búsquedas eficientes sobre el array
CREATE INDEX IF NOT EXISTS idx_profiles_allowed_store_ids
  ON profiles USING GIN (allowed_store_ids);

-- 3. RPC: admin puede actualizar las tiendas permitidas de un usuario
CREATE OR REPLACE FUNCTION update_user_allowed_stores(
  p_user_id        UUID,
  p_store_ids      UUID[]   -- NULL = acceso global, array vacío = acceso global, array con IDs = solo esas
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo admin puede ejecutar esto
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden modificar accesos de tienda';
  END IF;

  UPDATE profiles
    SET allowed_store_ids = CASE
          WHEN array_length(p_store_ids, 1) IS NULL THEN NULL  -- NULL o vacío => acceso global
          ELSE p_store_ids
        END,
        updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;
