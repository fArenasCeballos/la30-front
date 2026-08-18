# Regla 01: Arquitectura y Stack Tecnológico

## 1. Stack Aprobado y Dependencias
* **Framework:** React 18.3+ con Vite 8 y SWC.
* **Lenguaje:** TypeScript 5.9+ (modo estricto).
* **Estilos:** Tailwind CSS 4 (`@tailwindcss/postcss`). No usar Tailwind v3 `@tailwind` directives obsoletas ni styled-components.
* **Componentes:** Radix UI primitives + utilidades shadcn/ui (`cva`, `clsx`, `tailwind-merge`).
* **Icons:** `lucide-react`.
* **State Management:**
  * Servidor/Caché: `@tanstack/react-query` v5 (`staleTime: 5m`, `gcTime: 30m`).
  * Aplicación/Global: Contextos en `@/context/` (`AuthContext`, `StoreContext`, `OrderContext`, `NotificationContext`).
* **Package Manager:** `pnpm`. Prohibido usar `npm` o `yarn` que generen lockfiles conflictivos.

## 2. Convenciones de Código y Estructura
* **Imports con Alias:** Usar siempre alias `@/` que mapea a `src/`.
* **Lazy Loading de Vistas:** Toda página en `src/pages/` debe importarse con `lazy()` y renderizarse bajo `<Suspense fallback={<PageLoading />}>`.
* **Naming Conventions:**
  * Componentes y Páginas: `PascalCase` (`OrderCard.tsx`, `Kiosko.tsx`).
  * Hooks: `camelCase` con prefijo `use` (`useOrders.ts`).
  * Servicios y Utilidades: `camelCase` (`siigoService.ts`, `shiftUtils.ts`).
  * Tipos e Interfaces: `PascalCase` (`Order`, `SiigoInvoiceParams`).
* **Idioma:**
  * Código, variables, funciones, nombres de archivo: **Inglés** (`processPayment`, `activeStore`, `getShiftStart`).
  * UI, mensajes de usuario, toasts, etiquetas, reportes: **Español (Colombia)**.
