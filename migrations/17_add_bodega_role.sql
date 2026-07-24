-- ============================================================================
-- Migration 17: Add 'bodega' role and update permissions
-- ============================================================================

-- 1. Update the user_role enum safely
-- Note: ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block,
-- so we execute it in an independent statement.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'bodega';

-- 2. Update RPC get_my_profile (recreate)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(id uuid, name text, email text, role text, avatar_url text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.email, p.role::text, p.avatar_url, p.is_active
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$;

-- 3. Update RPC get_all_users (recreate)
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(id uuid, name text, email text, role text, avatar_url text, is_active boolean, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que quien consulta es admin (opcional: o permitir a otro rol si lo requiere)
  IF public.auth_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.email, p.role::text, p.avatar_url, p.is_active, p.created_at
  FROM profiles p
  ORDER BY p.name ASC;
END;
$$;

-- 4. Update RLS policies for inventory and bodega tables
-- Allow 'bodega' role to have ALL access to raw_materials, raw_material_entries, recipes, stock_movements, suppliers

DO $$ BEGIN
  -- raw_materials
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_materials' AND policyname = 'raw_materials_all_admin_bodega') THEN
    CREATE POLICY "raw_materials_all_admin_bodega"
      ON public.raw_materials FOR ALL
      TO authenticated
      USING (public.auth_user_role() IN ('admin', 'bodega'))
      WITH CHECK (public.auth_user_role() IN ('admin', 'bodega'));
  END IF;

  -- raw_material_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_entries' AND policyname = 'entries_all_admin_bodega') THEN
    CREATE POLICY "entries_all_admin_bodega"
      ON public.raw_material_entries FOR ALL
      TO authenticated
      USING (public.auth_user_role() IN ('admin', 'bodega'))
      WITH CHECK (public.auth_user_role() IN ('admin', 'bodega'));
  END IF;

  -- recipes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recipes' AND policyname = 'recipes_all_admin_bodega') THEN
    CREATE POLICY "recipes_all_admin_bodega"
      ON public.recipes FOR ALL
      TO authenticated
      USING (public.auth_user_role() IN ('admin', 'bodega'))
      WITH CHECK (public.auth_user_role() IN ('admin', 'bodega'));
  END IF;

  -- stock_movements
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'movements_all_admin_bodega') THEN
    CREATE POLICY "movements_all_admin_bodega"
      ON public.stock_movements FOR ALL
      TO authenticated
      USING (public.auth_user_role() IN ('admin', 'bodega'))
      WITH CHECK (public.auth_user_role() IN ('admin', 'bodega'));
  END IF;

  -- suppliers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'suppliers_all_admin_bodega') THEN
    CREATE POLICY "suppliers_all_admin_bodega"
      ON public.suppliers FOR ALL
      TO authenticated
      USING (public.auth_user_role() IN ('admin', 'bodega'))
      WITH CHECK (public.auth_user_role() IN ('admin', 'bodega'));
  END IF;

  -- raw_material_categories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_categories' AND policyname = 'rmc_all_admin_bodega') THEN
    CREATE POLICY "rmc_all_admin_bodega"
      ON public.raw_material_categories FOR ALL
      TO authenticated
      USING (public.auth_user_role() IN ('admin', 'bodega'))
      WITH CHECK (public.auth_user_role() IN ('admin', 'bodega'));
  END IF;
END $$;
