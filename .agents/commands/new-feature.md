# Comando: Desarrollar Nueva Funcionalidad (`new-feature`)

## Instrucción para el Agente
> "Vas a implementar una nueva funcionalidad en `la30-front`. Sigue estrictamente la arquitectura database-first, los lineamientos de TypeScript y el stack aprobado."

### Pasos de Ejecución Obligatorios:
1. **Revisar Modelo de Datos:**
   * Si requiere nuevas tablas o columnas, redacta la migración SQL en `migrations/` con RLS e idempotencia.
   * Define los tipos TypeScript en `src/types/index.ts`.
2. **Crear o Extender el Servicio (`src/lib/`):**
   * Encapsular llamadas a Supabase con queries tipadas o llamadas a RPCs.
   * Manejar errores descriptivos en español para los toasts.
3. **Construir Componentes UI (`src/components/`):**
   * Usar Tailwind CSS 4, Radix UI y Lucide Icons.
   * Adaptar para pantallas táctiles (tablets de POS/Kiosko) y desktop.
4. **Integrar con Estado y Vistas (`src/pages/`):**
   * Usar `useQuery` o `useMutation` de TanStack Query con keys compuestas: `[feature, storeId, ...]`.
   * Registrar la ruta en `src/App.tsx` usando `React.lazy()` si es una nueva página.
5. **Validación:**
   * Ejecutar `pnpm lint` y verificar que no existan errores de compilación con TypeScript.
