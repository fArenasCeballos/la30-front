# 🏪 GEMINI.md — Reglas & Guía para Agentes Gemini / Antigravity

Este archivo establece las directrices de arquitectura, negocio y desarrollo para **Gemini**, **Google Antigravity**, **Claude** y cualquier agente de IA que opere en **`la30-front`**.

---

## 1. Identidad y Contexto del Proyecto
* **Nombre:** `la30-front`
* **Tipo:** Sistema POS (Punto de Venta), KDS (Cocina), Domicilios, Bodega y Back-Office Multi-Tienda para **"La 30 Perros y Hamburguesas"** (Colombia).
* **Entorno:** PWA en producción activa. Cualquier cambio debe mantener la estabilidad operativa y resiliencia financiera.

---

## 2. Stack Tecnológico Estricto (NO negociable)
* **Frontend:** React 18 (SPA) + Vite 8 + TypeScript (~5.9) + Tailwind CSS 4.
* **UI & Animaciones:** Radix UI / shadcn/ui + Lucide React + Framer Motion.
* **Estado & Caché:** React Context API (Auth, Store, Order, Notification) + TanStack React Query v5.
* **Backend:** Supabase (PostgreSQL + PostGIS + RLS + RPCs + Edge Functions Deno).
* **Facturación & Pagos:** Siigo API (Facturación Electrónica DIAN) + Wompi (Pasarela Móvil).
* **Package Manager:** `pnpm` (NUNCA usar `npm` o `yarn`).
* **Imports:** Alias absoluto `@/` obligatorio (`@/components`, `@/lib`, `@/context`, etc.).

---

## 3. Jerarquía y Sistema de Customizaciones

El proyecto utiliza el sistema unificado de agentes en `.agents/`:

```text
.agents/
├── AGENTS.md               # Directrices generales de comportamiento
├── rules/                  # Reglas modulares por dominio técnico/negocio
│   ├── 01-architecture-and-stack.md
│   ├── 02-business-logic-and-shifts.md
│   ├── 03-database-and-migrations.md
│   ├── 04-payments-and-invoicing.md
│   ├── 05-security-and-best-practices.md
│   └── 06-testing-and-code-quality.md
├── commands/               # Prompts y plantillas de comandos para agentes
│   ├── new-feature.md
│   ├── create-migration.md
│   ├── debug-issue.md
│   ├── validate-all.md
│   ├── verify-and-build.md
│   └── test-offline-sync.md
└── skills/                 # Procedimientos y runbooks especializados
    ├── auth-and-multistore/
    ├── code-quality-and-testing/
    ├── debugging/
    ├── inventory-system/
    ├── new-feature/
    ├── order-management/
    ├── payment-and-invoice/
    ├── reporting-and-dashboard/
    ├── supabase-edge-function/
    ├── supabase-migration/
    └── ui-component/
```

---

## 4. Reglas Críticas de Arquitectura & Código
1. **Database-First / Backend-less:** La lógica de negocio transaccional (crear pedidos, procesar pagos, descontar inventario, arqueos de caja) se realiza mediante **RPCs de PostgreSQL** (`SECURITY DEFINER SET search_path = public`).
2. **Jerarquía de Providers (Inviolable):**
   ```
   QueryClientProvider → TooltipProvider → AuthProvider → StoreProvider → NotificationProvider → OrderProvider → BrowserRouter
   ```
3. **Turnos de Negocio (GMT-5 Colombia):** El inicio de turno estándar se calcula a las **12:00 PM** (`SHIFT_START_HOUR = 12` en `@/lib/shiftUtils.ts`). Si `hora < 12:00`, el turno pertenece al día anterior.
4. **Resiliencia Offline:** Los pedidos creados sin conexión a internet se encolan en `localStorage.la30_offline_orders_queue` y se sincronizan atómicamente cuando el cliente vuelve a estar online.
5. **Precios y Moneda:** Siempre enteros en COP sin decimales ($25.000 COP $\rightarrow$ `25000`).
6. **Gestión de Stock:** El inventario permite stock negativo (nunca bloquear una venta física en caja/kiosko por falta de stock registrado en sistema).
7. **Rutas y Lazy Loading:** Toda página nueva en `App.tsx` debe cargarse con `React.lazy()` y `Suspense`.
8. **Tolerancia Cero en Calidad:** Todo código entregado debe pasar `pnpm validate` (0 errores de TypeScript, 0 errores de ESLint, 100% pruebas de Vitest pasando).

---

## 5. Comandos de Terminal Permitidos
* Validación completa: `pnpm validate`
* Chequeo de tipos TypeScript: `pnpm typecheck`
* Formateo automático de código: `pnpm format`
* Ejecución de tests: `pnpm test`
* Linter: `pnpm lint`
* Iniciar servidor local: `pnpm dev`
* Compilar bundle: `pnpm build`

