# Comando: Crear Migración SQL (`create-migration`)

## Instrucción para el Agente
> "Crea una nueva migración SQL idempotente para Supabase siguiendo las convenciones de `la30-front`."

### Plantilla Estándar de Migración:

```sql
-- Migration: [NUM]_[nombre_descriptivo].sql
-- Descripción: [Propósito del cambio]

-- 1. Tabla o Alteración
CREATE TABLE IF NOT EXISTS public.ejemplo_tabla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_ejemplo_tabla_store_id ON public.ejemplo_tabla(store_id);

-- 3. Habilitar RLS
ALTER TABLE public.ejemplo_tabla ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS)
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver datos de su sede" ON public.ejemplo_tabla;
CREATE POLICY "Usuarios autenticados pueden ver datos de su sede"
ON public.ejemplo_tabla
FOR SELECT
TO authenticated
USING (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Procedimiento RPC (si aplica)
CREATE OR REPLACE FUNCTION public.crear_ejemplo(p_store_id UUID, p_nombre TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.ejemplo_tabla (store_id, nombre)
    VALUES (p_store_id, p_nombre)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
```
