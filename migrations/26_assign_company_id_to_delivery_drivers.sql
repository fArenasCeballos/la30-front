-- ============================================================================
-- Migración 26: Asignar company_id de La 30 a domiciliarios existentes
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================================================

-- 1. Actualizar domiciliarios existentes que tienen company_id en NULL
-- Asignándoles el ID de la empresa "La 30 Perros y Hamburguesas" (slug = 'la30')
UPDATE public.delivery_drivers
SET company_id = (
  SELECT id 
  FROM public.companies 
  WHERE slug = 'la30' 
  LIMIT 1
)
WHERE company_id IS NULL;

-- 2. Fallback de seguridad: si no existe slug 'la30', usar la primera empresa activa disponible
UPDATE public.delivery_drivers
SET company_id = (
  SELECT id 
  FROM public.companies 
  WHERE is_active = TRUE 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE company_id IS NULL;

-- 3. Consulta de comprobación: verificar que todos los domiciliarios tengan company_id asignado
SELECT 
  d.id, 
  d.first_name, 
  d.last_name, 
  d.motorcycle_plate, 
  d.phone, 
  d.is_active, 
  d.company_id,
  c.name AS company_name
FROM public.delivery_drivers d
LEFT JOIN public.companies c ON d.company_id = c.id
ORDER BY d.created_at DESC;
