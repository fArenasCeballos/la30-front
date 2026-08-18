# Regla 03: Base de Datos, RPCs y Migraciones

## 1. Convenciones de Migraciones SQL
* Las migraciones se almacenan en `migrations/` y deben ser nombradas con numeración secuencial de 2 dígitos y descripción en snake_case (ej: `21_add_loyalty_points.sql`).
* **Idempotencia Estricta:** Toda sentencia DDL debe ser segura de re-ejecutar:
  ```sql
  CREATE TABLE IF NOT EXISTS public.mi_tabla (...);
  ALTER TABLE public.mi_tabla ADD COLUMN IF NOT EXISTS mi_columna text;
  CREATE INDEX IF NOT EXISTS idx_mi_tabla_store ON public.mi_tabla(store_id);
  ```

## 2. Row Level Security (RLS) Obligatorio
* Toda tabla creada en `public` debe tener RLS habilitado:
  ```sql
  ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
  ```
* Se deben definir políticas claras para usuarios autenticados basados en `store_id` y para administradores (`profiles.role = 'admin'`).

## 3. Procedimientos Almacenados (RPCs)
* La lógica crítica debe encapsularse en funciones PL/pgSQL:
  ```sql
  CREATE OR REPLACE FUNCTION public.mi_operacion_transaccional(
      p_store_id UUID,
      p_datos JSONB
  )
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
      -- Validaciones de seguridad y negocio
      -- Ejecución atómica dentro de la transacción
      RETURN jsonb_build_object('success', true);
  END;
  $$;
  ```
* Usar siempre `SECURITY DEFINER` con `SET search_path = public` explícito para mitigar vulnerabilidades de inyección de rutas.

## 4. Tipado TypeScript de la Base de Datos
* **NUNCA** editar manualmente `src/types/database.types.ts`.
* Generar los tipos automáticamente con el CLI de Supabase:
  ```bash
  supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.types.ts
  ```
