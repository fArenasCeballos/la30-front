---
name: new-feature
description: Crear nuevas funcionalidades completas en la30-front siguiendo la arquitectura establecida. Incluye componentes React, hooks, servicios, tipos TypeScript y conexión con Supabase.
---

# Skill: New Feature Development

## Cuándo usar este skill
Cuando el usuario pida agregar una nueva funcionalidad completa que involucre:
- Nuevas páginas o secciones.
- Nuevos componentes con lógica de negocio.
- Nuevos servicios de datos.
- Integración con nuevas tablas/RPCs de Supabase.

## Checklist de desarrollo

### 1. Tipos (types/)
```typescript
// En src/types/index.ts o src/types/[feature].types.ts
import type { Tables } from "./database.types";

export type MiEntidad = Tables<"mi_tabla">;

// Tipos derivados con joins
export interface MiEntidadConRelaciones extends MiEntidad {
  otra_tabla: OtraEntidad | null;
}
```

### 2. Servicio de datos (lib/)
```typescript
// src/lib/[feature]Service.ts
import { supabase } from "@/lib/supabase";
import type { MiEntidad } from "@/types";

export async function getMiEntidad(storeId: string): Promise<MiEntidad[]> {
  const { data, error } = await supabase
    .from("mi_tabla")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Error: ${error.message}`);
  return (data ?? []) as MiEntidad[];
}

// CRUD siguiendo patrón de inventoryService.ts
```

### 3. Hook o Query (hooks/ o inline)
```typescript
// Patrón con TanStack Query
const { data, isLoading, refetch } = useQuery({
  queryKey: ["mi-entidad", user?.id, storeId],
  queryFn: () => getMiEntidad(storeId!),
  staleTime: 1000 * 60 * 5, // 5 min para catálogos
  enabled: !!storeId,
});
```

### 4. Componente (components/)
```tsx
// Patrón de componente con form (React Hook Form + Zod)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  precio: z.number().positive("El precio debe ser positivo"),
});

type FormData = z.infer<typeof schema>;

export function MiComponente() {
  const { activeStore } = useStore();
  const queryClient = useQueryClient();
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", precio: 0 },
  });

  const onSubmit = async (data: FormData) => {
    // ... crear/actualizar
    queryClient.invalidateQueries({ queryKey: ["mi-entidad"] });
    toast.success("Guardado exitosamente");
  };

  return (/* JSX */);
}
```

### 5. Página (pages/)
```tsx
// src/pages/MiPagina.tsx — SIEMPRE export default para lazy loading
export default function MiPagina() {
  const { user } = useAuth();
  const { activeStore } = useStore();
  
  if (!user || !activeStore) return null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Mi Página</h1>
      {/* ... */}
    </div>
  );
}
```

### 6. Routing (App.tsx)
```tsx
// Agregar lazy import
const MiPagina = lazy(() => import("./pages/MiPagina"));

// Agregar ruta dentro de <Route element={<AppLayout />}>
<Route path="/mi-ruta" element={<MiPagina />} />
```

### 7. Navegación (AppLayout.tsx)
```tsx
// Agregar a NAV_ITEMS
{ to: "/mi-ruta", label: "Mi Página", icon: MiIcono, roles: ["admin"] },
```

## Patrones obligatorios

### Optimistic Updates (para operaciones rápidas)
```typescript
// 1. Guardar estado anterior
const previous = queryClient.getQueryData(["key"]);

// 2. Aplicar cambio optimista
queryClient.setQueryData(["key"], (old) => /* nuevo estado */);

// 3. Ejecutar mutación
const { error } = await supabase...;

// 4. Rollback si falla
if (error) {
  queryClient.setQueryData(["key"], previous);
  toast.error(`Error: ${error.message}`);
}
```

### Toast Messages
```typescript
toast.success("Operación exitosa");        // Verde
toast.error(`Error: ${error.message}`);    // Rojo
toast.warning("⚠️ Advertencia");           // Amarillo
toast.loading("Procesando...");            // Con spinner
toast.info("Información");                 // Azul
```

### Filtrado por Tienda
```typescript
// Para tablas con store_id (transaccional)
query.eq("store_id", storeId);

// Para tablas con store_ids[] (catálogo)
query.contains("store_ids", [storeId]);
```
