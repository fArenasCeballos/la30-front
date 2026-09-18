-- ============================================================================
-- Migración 27: Asignar company_id de La 30 a zonas de cobertura existentes
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================================

-- 1. Asegurar columna company_id e índice en delivery_zones si no existen
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_company_id ON public.delivery_zones(company_id);

-- 2. Actualizar zonas de cobertura existentes que tienen company_id en NULL
-- Asignándoles el ID de la empresa "La 30 Perros y Hamburguesas" (slug = 'la30')
UPDATE public.delivery_zones
SET company_id = (
  SELECT id 
  FROM public.companies 
  WHERE slug = 'la30' 
  LIMIT 1
)
WHERE company_id IS NULL;

-- 3. Fallback de seguridad: si no existe slug 'la30', usar la primera empresa activa disponible
UPDATE public.delivery_zones
SET company_id = (
  SELECT id 
  FROM public.companies 
  WHERE is_active = TRUE 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE company_id IS NULL;

-- 4. Consulta de comprobación: verificar que todas las zonas tengan company_id asignado
SELECT 
  z.id, 
  z.name, 
  z.price, 
  z.color, 
  z.is_active, 
  z.company_id,
  c.name AS company_name
FROM public.delivery_zones z
LEFT JOIN public.companies c ON z.company_id = c.id
ORDER BY z.name ASC;
