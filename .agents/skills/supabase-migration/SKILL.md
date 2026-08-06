---
name: supabase-migration
description: Crear migraciones SQL idempotentes para la base de datos Supabase PostgreSQL del proyecto la30-front. Incluye tablas, RPCs, triggers, RLS y índices siguiendo las convenciones del proyecto.
---

# Skill: Supabase Migration

## Cuándo usar este skill
Usa este skill cuando necesites:
- Crear nuevas tablas en la base de datos.
- Crear o actualizar RPCs (funciones almacenadas).
- Agregar columnas, índices o constraints.
- Modificar políticas de RLS.
- Crear triggers para automatización.

## Convenciones de Migraciones

### Nomenclatura
- Archivo: `migrations/XX_nombre_descriptivo.sql` (XX = número secuencial).
- Consulta el último número en `migrations/` antes de crear un nuevo archivo.

### Estructura estándar del archivo SQL
```sql
-- ============================================================
-- SCRIPT XX: [Nombre descriptivo]
-- [Breve descripción del cambio]
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- Este script es idempotente (se puede ejecutar varias veces sin problema)
-- ============================================================

-- 1. Tablas
CREATE TABLE IF NOT EXISTS public.mi_tabla (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id   UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- ... columnas ...
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mi_tabla_store_id
  ON public.mi_tabla(store_id);

-- Comentarios
COMMENT ON TABLE public.mi_tabla
  IS 'Descripción de la tabla';

-- 2. RLS (obligatorio)
ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mi_tabla' AND policyname = 'mi_tabla_select') THEN
    CREATE POLICY mi_tabla_select ON public.mi_tabla
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mi_tabla' AND policyname = 'mi_tabla_all_admin') THEN
    CREATE POLICY mi_tabla_all_admin ON public.mi_tabla
      FOR ALL TO authenticated
      USING (public.auth_user_role() = 'admin')
      WITH CHECK (public.auth_user_role() = 'admin');
  END IF;
END $$;

-- 3. RPCs
CREATE OR REPLACE FUNCTION mi_funcion(
  p_param1 UUID,
  p_param2 TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- variables
BEGIN
  -- Validar permisos
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin') AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  -- Lógica
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION mi_funcion(UUID, TEXT) TO authenticated;
```

### Reglas inquebrantables

1. **Idempotencia**: Usar `IF NOT EXISTS`, `CREATE OR REPLACE`, `DO $$ ... $$`.
2. **RLS obligatorio**: Toda tabla nueva DEBE tener RLS habilitado con al menos:
   - Política de SELECT para `authenticated`.
   - Política de ALL para `admin`.
3. **RPCs SECURITY DEFINER**: Siempre con `SET search_path = public`.
4. **store_id**: Toda tabla transaccional o de inventario DEBE incluir `store_id UUID NOT NULL REFERENCES stores(id)`.
5. **Catálogos multi-tienda**: Usan `store_ids UUID[]` (array) en lugar de `store_id`.
6. **Auditoría**: Incluir `created_at TIMESTAMPTZ DEFAULT now()` y `updated_at` cuando aplique.
7. **GRANT**: Toda función nueva necesita `GRANT EXECUTE ON FUNCTION ... TO authenticated`.
8. **Comentarios SQL**: `COMMENT ON TABLE/FUNCTION` para documentación.

### Patrón de Trigger para updated_at
```sql
CREATE OR REPLACE FUNCTION set_tabla_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tabla_updated_at ON public.mi_tabla;
CREATE TRIGGER trg_tabla_updated_at
  BEFORE UPDATE ON public.mi_tabla
  FOR EACH ROW
  EXECUTE FUNCTION set_tabla_updated_at();
```

### Patrón para agregar columnas a tablas existentes
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mi_tabla' AND column_name = 'nueva_columna'
  ) THEN
    ALTER TABLE public.mi_tabla
      ADD COLUMN nueva_columna TEXT DEFAULT NULL;
  END IF;
END $$;
```

## Después de crear la migración
1. Recuerda al usuario que debe ejecutar el SQL en el **Supabase SQL Editor**.
2. Si se agregan nuevas tablas/columnas, recuerda actualizar `src/types/database.types.ts` con `supabase gen types typescript`.
3. Si se crean nuevas RPCs, documenta los parámetros y el retorno.
