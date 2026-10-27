-- ============================================================
-- SCRIPT 30: Add is_available_app to categories
-- Permite controlar si una categoría se visualiza en la app móvil (la30-app)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_available_app'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN is_available_app BOOLEAN NOT NULL DEFAULT true;
    COMMENT ON COLUMN public.categories.is_available_app IS 'Determina si la categoría se visualiza en el catálogo de la app móvil (la30-app).';
  END IF;
END $$;

-- Índice para optimizar consultas de la app móvil
CREATE INDEX IF NOT EXISTS idx_categories_is_available_app ON public.categories(is_available_app) WHERE is_available_app = true;
