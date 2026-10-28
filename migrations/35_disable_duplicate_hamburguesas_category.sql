-- ============================================================
-- SCRIPT 35: Desactivar categoría duplicada de hamburguesas
-- ============================================================
-- La categoría 'hamburguesas' (id: '9ad2bd74-b6ff-4af1-86cb-f81f797f2fd0')
-- es un registro duplicado que contiene combos/adicionales y pertenece a otra sede.
-- Desactivar en la app móvil para mantener sincronización limpia.

UPDATE public.categories
SET is_available_app = false
WHERE id = '9ad2bd74-b6ff-4af1-86cb-f81f797f2fd0';

UPDATE public.products
SET is_available_app = false
WHERE category_id = '9ad2bd74-b6ff-4af1-86cb-f81f797f2fd0';
