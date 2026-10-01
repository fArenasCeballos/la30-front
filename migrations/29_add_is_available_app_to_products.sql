-- ============================================================
-- SCRIPT 29: Add is_available_app to products
-- Permite controlar si un producto se visualiza en la app móvil la30-app
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_available_app'
  ) THEN
    ALTER TABLE public.products ADD COLUMN is_available_app BOOLEAN NOT NULL DEFAULT true;
    COMMENT ON COLUMN public.products.is_available_app IS 'Determina si el producto se visualiza en el catálogo de la app móvil (la30-app).';
  END IF;
END $$;

-- Índice para optimizar consultas de la app móvil
CREATE INDEX IF NOT EXISTS idx_products_is_available_app ON public.products(is_available_app) WHERE is_available_app = true;
