# 🏪 la30-front — Reglas para Agentes IA

## 1. Identidad del Proyecto

**la30-front** es un sistema POS (Punto de Venta) y gestión integral de restaurante multi-tienda para **"La 30 Perros y Hamburguesas"**, un negocio colombiano de comida rápida. Se despliega como **PWA** (Progressive Web App) con soporte offline y se utiliza activamente en operaciones diarias de producción.

> ⚠️ **PROYECTO EN PRODUCCIÓN**: Todo cambio DEBE ser tratado con cuidado de producción. Nunca hagas cambios destructivos en migraciones, RPCs o estructura de datos sin confirmación explícita del usuario.

---

## 2. Stack Tecnológico (No Negociable)

| Capa             | Tecnología                          | Versión         |
|------------------|-------------------------------------|-----------------|
| Framework        | React 18 (SPA)                      | ^18.3.1         |
| Build            | Vite 8 + SWC                        | ^8.0.0          |
| Lenguaje         | TypeScript (strict)                 | ~5.9.3          |
| Estilos          | Tailwind CSS 4 + PostCSS            | ^4.2.2          |
| UI Components    | Radix UI + shadcn/ui (CVA)          | Varias          |
| Estado Global    | React Context + TanStack Query v5   | ^5.83.0         |
| Routing          | React Router v6                     | ^6.30.1         |
| Backend          | Supabase (PostgreSQL)               | ^2.100.0        |
| Forms            | React Hook Form + Zod               | v7 / v3         |
| Gráficos         | Recharts                            | ^2.15.4         |
| Animaciones      | Framer Motion                       | ^12.38.0        |
| Iconos           | Lucide React                        | ^0.462.0        |
| Mapas            | React Leaflet + Leaflet Draw        | ^4.2.1          |
| Facturación      | Siigo API (Edge Functions Deno)     | v1              |
| Deploy           | Vercel                              | —               |
| Package Manager  | pnpm                                | latest          |

### Reglas de Stack
- **NUNCA** instales npm packages que dupliquen funcionalidad existente (ej: no agregar `axios` porque ya usamos `supabase-js`).
- **NUNCA** cambies de Tailwind a CSS modules, styled-components, etc.
- **SIEMPRE** usa imports con alias `@/` (mapeado a `./src/`).
- **SIEMPRE** usa `pnpm` como package manager (no npm ni yarn).
- Los tipos de DB se generan en `src/types/database.types.ts` — NO editar manualmente, usa `supabase gen types`.

---

## 3. Arquitectura de la Aplicación

### 3.1 Patrón: Database-First / Backend-less
La lógica de negocio crítica (crear pedidos, procesar pagos, cierres de caja, descuento de inventario) reside en **procedimientos almacenados (RPCs)** de PostgreSQL, NO en el frontend. El frontend es un consumidor que:
1. Invoca RPCs para operaciones transaccionales.
2. Lee datos vía queries de Supabase con TanStack Query.
3. Recibe actualizaciones en tiempo real vía Supabase Realtime.

### 3.2 Jerarquía de Providers (orden obligatorio)
```
QueryClientProvider
  └─ TooltipProvider
       └─ AuthProvider
            └─ StoreProvider
                 └─ NotificationProvider
                      └─ OrderProvider
                           └─ BrowserRouter (Routes)
```
**NUNCA** alteres este orden. Cada provider depende del anterior.

### 3.3 Estructura de Carpetas
```
src/
├── components/          # Componentes reutilizables
│   ├── ui/              # Primitivos shadcn/ui (NO editar directamente)
│   ├── admin/           # Componentes de administración (zonas, mapa)
│   ├── bodega/          # Gestión de inventario (CRUD categorías, productos, opciones)
│   └── inventory/       # Tabs de bodega (materiales, entradas, recetas, movimientos)
├── context/             # Providers globales (Auth, Store, Order, Notification)
├── hooks/               # Custom hooks (use-mobile, use-toast)
├── lib/                 # Servicios y utilidades puras
│   ├── supabase.ts      # Cliente singleton
│   ├── shiftUtils.ts    # Cálculos de turno (12PM-12PM)
│   ├── siigoService.ts  # Lógica de facturación electrónica
│   ├── inventoryService.ts  # CRUD inventario/materia prima
│   ├── receiptUtils.ts  # Generación HTML de tirillas térmicas (80mm)
│   ├── formatPrice.ts   # Formato de precios COP
│   ├── imageUtils.ts    # Upload/resize imágenes a Supabase Storage
│   └── unitConversions.ts   # Conversión de unidades de inventario
├── pages/               # Páginas principales (lazy-loaded)
├── types/               # Definiciones TypeScript
│   ├── database.types.ts    # Auto-generado por Supabase CLI
│   ├── index.ts             # Re-exports y tipos derivados
│   └── inventory.types.ts   # Tipos del sistema de inventario
└── assets/              # Recursos estáticos
```

### 3.4 Páginas y Roles
| Página             | Roles permitidos              | Descripción                              |
|--------------------|-------------------------------|------------------------------------------|
| `/dashboard`       | admin                         | KPIs del turno actual                    |
| `/kiosko`          | mesero, admin, caja           | Toma de pedidos (interfaz tipo menú)     |
| `/caja`            | caja, admin                   | Gestión de pagos y tirilla               |
| `/domicilios`      | caja, admin                   | Gestión de domicilios                    |
| `/cocina`          | cocina, admin, caja           | Pantalla de preparación                  |
| `/mis-pedidos`     | mesero, caja, admin           | Historial de pedidos del usuario         |
| `/administracion`  | admin                         | Productos, reportes, inventario, usuarios|
| `/select-store`    | admin                         | Selector de tienda activa                |

---

## 4. Lógica de Negocio Crítica

### 4.1 Turnos (Shifts)
- **Inicio**: 12:00 PM (mediodía) — configurable en `src/lib/shiftUtils.ts` → `SHIFT_START_HOUR = 12`.
- **Fin**: 12:00 PM del día siguiente.
- Si la hora actual es < 12PM, el turno activo es el de ayer.
- **Las RPCs de dashboard/reportería en la DB usan 16:00 (4PM)** como hora de turno — hay una DISCREPANCIA intencional entre el frontend (12PM) y algunas RPCs antiguas (4PM). Al crear nuevas RPCs, usa la lógica del frontend (12PM).

### 4.2 Multi-Tienda
- Entidades transaccionales (`orders`, `cash_register_closings`) tienen `store_id` obligatorio.
- Catálogos (`products`, `categories`, `custom_options`, `extras`) usan `store_ids[]` (array de UUIDs) para visibilidad multi-tienda.
- La tienda activa se persiste en `localStorage` con key `la30_active_store` (almacena el slug).
- **RLS** filtra datos por store_id automáticamente.

### 4.3 Flujo de Pedidos (Pipeline)
```
pendiente → confirmado → en_preparacion → listo → entregado
                                                 → cancelado
```
- `addOrder()` → RPC `create_order` (valida tienda, productos, disponibilidad).
- Pagos → RPC `process_payment` → cambia status a `en_preparacion`.
- Stock se descuenta **fire-and-forget** vía `deductStockFromOrder()` tras el pago.

### 4.4 Soporte Offline
- Cuando `navigator.onLine === false`, pedidos se guardan en `localStorage` bajo `la30_offline_orders_queue`.
- Se sincronizan automáticamente al recuperar conexión (event `online` + polling cada 30s).
- Los pedidos offline se muestran con indicador visual `isOfflinePending: true`.

### 4.5 Facturación Electrónica (Siigo)
- **Toda venta genera factura** (efectivo, tarjeta, nequi, mixto).
- El frontend determina la configuración via `getInvoiceConfigs()` en `siigoService.ts`.
- Pagos mixtos pueden generar **múltiples facturas** (una por método de pago).
- La Edge Function `siigo-invoice` actúa como proxy seguro (token cacheado en memoria).
- Resultados se registran en tabla `siigo_invoices`.

### 4.6 Inventario y Recetas
- `raw_materials` → catálogo de materia prima por tienda.
- `recipes` → relación producto → materia prima (cantidad requerida por unidad vendida).
- `stock_movements` → trazabilidad completa de movimientos.
- RPC `deduct_stock_from_order` → idempotente, permite stock negativo, nunca bloquea ventas.
- Trigger `trg_entry_stock_update` → actualiza stock automáticamente al registrar compras.

---

## 5. Convenciones de Código

### 5.1 TypeScript
- Modo estricto siempre activado.
- Usa `type` imports: `import type { Order } from "@/types"`.
- Nunca uses `any` excepto en boundaries con APIs externas (documenta con comentario `// eslint-disable...`).
- Re-exporta tipos de DB desde `src/types/index.ts` usando `Tables<"tabla">` helper.

### 5.2 React
- **Componentes funcionales** exclusivamente, nunca class components.
- Usa `useCallback` y `useMemo` en providers y componentes pesados.
- **Lazy loading** obligatorio para todas las páginas en `App.tsx`.
- Context values siempre envueltos en `useMemo()`.
- Hooks personalizados con prefijo `use-` en archivos `.ts` o `.tsx`.

### 5.3 Queries (TanStack Query)
- `queryKey` siempre incluye: `[nombre, userId, storeId]` para invalidación correcta.
- `staleTime`: 5 min para catálogos, 1 min para órdenes, 30s para órdenes activas.
- Siempre implementa fallback a caché de `localStorage` en el `queryFn` catch.

### 5.4 Supabase
- NUNCA hagas queries sin filtro de `store_id` en tablas transaccionales.
- Las operaciones de escritura van a través de RPCs, NUNCA inserts directos desde el frontend (excepto `notifications`).
- Realtime solo para `orders` y `order_items` — no suscribierse a más tablas sin justificación.

### 5.5 Estilos (Tailwind)
- Usa `cn()` de `@/lib/utils` para composición de clases condicionales.
- Componentes UI base vienen de shadcn/ui — modifícalos solo si es estrictamente necesario.
- Diseño responsive: mobile-first, optimizado para tablets (Kiosko/Cocina).
- Temas de color por tienda definidos en `stores.color` (hex).

### 5.6 Migraciones SQL
- Siempre idempotentes: usa `IF NOT EXISTS`, `CREATE OR REPLACE`, `DO $$ ... $$`.
- Numera secuencialmente: `XX_nombre_descriptivo.sql`.
- Incluye `COMMENT ON TABLE/FUNCTION` para documentación.
- RLS obligatorio en toda tabla nueva con políticas para `authenticated`.
- Funciones RPC son `SECURITY DEFINER` con `SET search_path = public`.

---

## 6. Métodos de Pago (Colombia)

| Método             | Clave interna      | Genera factura |
|--------------------|--------------------|----|
| Efectivo           | `efectivo`         | ✅ |
| Tarjeta Crédito    | `tarjeta_credito`  | ✅ |
| Tarjeta Débito     | `tarjeta_debito`   | ✅ |
| Nequi              | `nequi`            | ✅ |
| Daviplata          | `daviplata`        | ✅ |
| Mixto              | `mixto`            | ✅ (múltiples facturas) |

El breakdown de pagos mixtos se desglosa en: `efectivo`, `tarjeta`, `nequi`, `tarjeta_credito`, `tarjeta_debito`, `daviplata`.

---

## 7. Variables de Entorno

| Variable                 | Descripción                        | Dónde se usa        |
|--------------------------|------------------------------------|---------------------|
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase          | Frontend            |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase               | Frontend            |
| `VITE_SIIGO_ENABLED`     | Activa/desactiva facturación Siigo | Frontend            |
| `SIIGO_USERNAME`          | Email de cuenta Siigo              | Edge Function       |
| `SIIGO_ACCESS_KEY`        | API key de Siigo                   | Edge Function       |
| `SIIGO_DOCUMENT_TYPE_ID`  | ID del tipo de documento en Siigo  | Edge Function       |
| `SIIGO_SELLER_ID`         | ID del vendedor en Siigo           | Edge Function       |

---

## 8. Reglas de Seguridad

- **NUNCA** expongas service_role_key en el frontend.
- **NUNCA** desactives RLS en tablas de producción.
- RPCs con `SECURITY DEFINER` siempre validan `auth.uid()` y roles internamente.
- Las Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` — solo disponible server-side.
- Auto-logout por inactividad configurado a **1 hora**.
- Soporte de logout global (broadcast vía Supabase Realtime).

---

## 9. Reglas de Performance

- **Lazy loading** en todas las páginas vía `React.lazy()`.
- **Manual chunks** en Vite: vendor-react, vendor-radix, vendor-recharts, vendor-lucide, vendor-supabase.
- **Cache de imágenes** de Supabase Storage por 7 días (CacheFirst strategy en Service Worker).
- **Cache de API** Supabase por 5 min (NetworkFirst strategy).
- `chunkSizeWarningLimit: 600` en build config.

---

## 10. Comandos del Proyecto

```bash
pnpm install          # Instalar dependencias
pnpm dev              # Servidor de desarrollo (puerto 8080)
pnpm build            # Build de producción
pnpm preview          # Preview del build
pnpm lint             # ESLint
```

---

## 11. Tablas Principales de la Base de Datos

| Tabla                       | Propósito                              |
|-----------------------------|----------------------------------------|
| `stores`                    | Puntos de venta (restaurante, tráiler) |
| `profiles`                  | Usuarios y roles (FK → auth.users)     |
| `categories`                | Categorías de productos (store_ids[])  |
| `products`                  | Catálogo de productos (store_ids[])    |
| `product_custom_options`    | Opciones de personalización            |
| `product_custom_choices`    | Opciones dentro de cada opción         |
| `product_extras`            | Extras con precio adicional            |
| `orders`                    | Pedidos (store_id obligatorio)         |
| `order_items`               | Items de cada pedido                   |
| `payments`                  | Registro de pagos                      |
| `cash_register_closings`    | Cierres de caja                        |
| `notifications`             | Sistema de notificaciones              |
| `siigo_invoices`            | Tracking de facturación electrónica    |
| `siigo_customers`           | Clientes Siigo (cache local)           |
| `delivery_zones`            | Zonas de domicilio con polígonos       |
| `delivery_drivers`          | Domiciliarios                          |
| `raw_materials`             | Materia prima / insumos                |
| `raw_material_categories`   | Categorías de materia prima            |
| `raw_material_entries`      | Compras de materia prima               |
| `recipes`                   | Recetas (producto → materia prima)     |
| `stock_movements`           | Movimientos de stock                   |
| `suppliers`                 | Proveedores                            |

---

## 12. RPCs Críticas (PostgreSQL Functions)

| RPC                          | Propósito                                  |
|------------------------------|-------------------------------------------|
| `create_order`               | Crea pedido con validaciones completas    |
| `update_order`               | Actualiza items de un pedido existente    |
| `update_order_status`        | Cambia estado del pedido                  |
| `process_payment`            | Registra pago con desglose por método     |
| `get_dashboard_stats`        | Estadísticas del turno para dashboard     |
| `get_top_products`           | Productos más vendidos del turno          |
| `get_reporteria_stats`       | Estadísticas de reportería (rango fechas) |
| `generate_cash_closing`      | Cierre de caja con totales               |
| `deduct_stock_from_order`    | Descuenta inventario vía recetas          |
| `toggle_order_item_completed`| Marca item de cocina como completado      |
| `cleanup_old_records`        | Limpieza diaria de registros antiguos     |
| `has_other_sessions`         | Detecta sesiones activas en otros dispositivos |

---

## 13. Idioma

- La aplicación está en **español (Colombia)**.
- Mensajes al usuario, toasts, labels: siempre en español.
- Nombres de variables, funciones, tipos: en **inglés** (convención de código).
- Comentarios en código: pueden ser en español o inglés, pero consistentes dentro del archivo.

---

## 14. Índice de Customizaciones para Agentes (.agents/)

* **Reglas Modulares (`.agents/rules/`):**
  * `01-architecture-and-stack.md`: Stack, Vite, Tailwind 4, convenciones.
  * `02-business-logic-and-shifts.md`: Turnos a las 12 PM, multi-tienda, offline sync.
  * `03-database-and-migrations.md`: RLS, migraciones idempotentes, RPCs seguras.
  * `04-payments-and-invoicing.md`: Siigo, Wompi, recibos térmicos.
  * `05-security-and-best-practices.md`: Roles, sin secretos en frontend, política de stock.
  * `06-testing-and-code-quality.md`: Tolerancia cero: TypeScript (`pnpm typecheck`), ESLint (`pnpm lint`), tests con Vitest (`pnpm test`).
* **Comandos y Prompts (`.agents/commands/`):**
  * `new-feature.md`, `create-migration.md`, `debug-issue.md`, `validate-all.md`, `verify-and-build.md`, `test-offline-sync.md`.
* **Skills Especializados (`.agents/skills/`):**
  * `code-quality-and-testing`: Runbook de validación integral (typecheck + lint + test + build).
  * Ver runbooks en cada carpeta de `skills/` para flujos paso a paso.


