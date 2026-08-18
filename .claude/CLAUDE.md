# CLAUDE.md — Reglas para Claude Code en la30-front

## Proyecto
**la30-front** es un sistema POS y gestión de restaurante multi-tienda para "La 30 Perros y Hamburguesas" (Colombia). Es una PWA en producción con soporte offline.

## Stack (NO cambiar)
- **Frontend**: React 18 + Vite 8 + TypeScript 5.9 + Tailwind CSS 4
- **UI**: shadcn/ui (Radix UI + CVA) + Framer Motion + Lucide Icons
- **State**: React Context + TanStack Query v5
- **Backend**: Supabase (PostgreSQL + Edge Functions Deno + Realtime + Storage)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Maps**: React Leaflet
- **Deploy**: Vercel | **Package Manager**: pnpm

## Arquitectura Crítica

### Database-First
La lógica de negocio vive en **RPCs de PostgreSQL** (create_order, process_payment, etc.), NO en el frontend. El frontend es consumidor.

### Provider Chain (orden obligatorio)
```
QueryClientProvider → AuthProvider → StoreProvider → NotificationProvider → OrderProvider → BrowserRouter
```

### Multi-Tienda
- Tablas transaccionales: `store_id` (UUID FK → stores).
- Catálogos: `store_ids[]` (UUID array) para visibilidad compartida.
- Tienda activa en `localStorage.la30_active_store` (slug).

### Turnos
- Frontend: `SHIFT_START_HOUR = 12` (mediodía) en `src/lib/shiftUtils.ts`.
- Algunas RPCs antiguas usan 4PM — al crear nuevas, usar 12PM.

## Reglas Estrictas

1. **Imports**: Siempre usar alias `@/` (→ `./src/`).
2. **Package Manager**: `pnpm` (no npm/yarn).
3. **Types**: Regenerar con `supabase gen types` — NO editar `database.types.ts` manualmente.
4. **Lazy Loading**: Toda página nueva debe usar `React.lazy()` en `App.tsx`.
5. **Queries**: queryKey siempre incluye `[nombre, userId, storeId]`.
6. **RPCs**: `SECURITY DEFINER SET search_path = public`, validar `auth.uid()` y roles.
7. **RLS**: Toda tabla nueva con RLS habilitado + políticas para authenticated y admin.
8. **Migraciones**: Idempotentes (`IF NOT EXISTS`, `CREATE OR REPLACE`), numeradas secuencialmente.
9. **Precios**: Enteros en COP (sin decimales). $25,000 → `25000`.
10. **Idioma UI**: Español (Colombia). Variables/funciones en inglés.
11. **No duplicar infraestructura**: No agregar axios, moment.js, styled-components, etc.
12. **Escrituras**: Vía RPCs, NO inserts directos (excepto notifications).
13. **Offline**: Pedidos offline en `la30_offline_orders_queue` en localStorage.
14. **Stock negativo**: Permitido — nunca bloquear ventas por inventario.
15. **Seguridad**: NUNCA exponer service_role_key en frontend.

## Métodos de Pago
`efectivo`, `tarjeta_credito`, `tarjeta_debito`, `nequi`, `daviplata`, `mixto`
Todos generan factura electrónica Siigo.

## Archivos Grandes (precaución al editar)
| Archivo | Tamaño | Qué hace |
|---------|--------|----------|
| `Reporteria.tsx` | 89KB | Reportes con rangos de fecha |
| `PaymentCalculator.tsx` | 71KB | UI de cobro |
| `Kiosko.tsx` | 60KB | Menú de toma de pedidos |
| `Domicilios.tsx` | 50KB | Gestión de domicilios |
| `Caja.tsx` | 46KB | Pantalla de caja |
| `OrderContext.tsx` | 35KB | Estado global de pedidos |
| `database.types.ts` | 30KB | Tipos auto-generados |

## Estructura de Carpetas
```
src/
├── components/       # Componentes (ui/, admin/, bodega/, inventory/)
├── context/          # Auth, Store, Order, Notification providers
├── hooks/            # use-mobile, use-toast
├── lib/              # Servicios puros (supabase, shift, siigo, inventory, receipt)
├── pages/            # Páginas lazy-loaded
├── types/            # database.types.ts, index.ts, inventory.types.ts
└── assets/
migrations/           # SQL idempotentes para Supabase
supabase/functions/   # Edge Functions (Deno) - siigo-invoice, siigo-get-products
```

## Consulta rápida de Skills, Reglas y Comandos
Revisa `.agents/` para documentación detallada:
- **Reglas modulares**: `.agents/rules/` (`01-architecture-and-stack.md`, `02-business-logic-and-shifts.md`, `03-database-and-migrations.md`, `04-payments-and-invoicing.md`, `05-security-and-best-practices.md`, `06-testing-and-code-quality.md`).
- **Comandos & Prompts**: `.agents/commands/` (`new-feature.md`, `create-migration.md`, `debug-issue.md`, `validate-all.md`, `verify-and-build.md`, `test-offline-sync.md`).
- **Skills**:
  - `code-quality-and-testing` — Verificación rigurosa (typecheck + lint + test + build)
  - `supabase-migration` — Crear migraciones SQL
  - `new-feature` — Desarrollar features completas
  - `supabase-edge-function` — Edge Functions Deno
  - `payment-and-invoice` — Flujo de pagos y facturación
  - `inventory-system` — Sistema de inventario
  - `order-management` — Ciclo de vida de pedidos
  - `reporting-and-dashboard` — Reportería y KPIs
  - `ui-component` — Componentes UI
  - `auth-and-multistore` — Auth, roles y multi-tienda
  - `debugging` — Diagnóstico de problemas


