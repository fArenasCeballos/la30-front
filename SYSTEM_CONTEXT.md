# SYSTEM_CONTEXT: la30-front (Comprehensive Technical & BI Manual)

## 1. Introducción y Arquitectura de Alto Nivel
`la30-front` es un sistema POS (Punto de Venta) y gestión de restaurantes multi-tienda. Su arquitectura está diseñada para **alta disponibilidad, resiliencia operativa (modo offline) y consistencia financiera**.

- **Frontend:** React (SPA) con Vite, TypeScript, Tailwind 4.
- **Backend:** Supabase (PostgreSQL).
- **Modelo:** *Backend-less* / *Database-first*. La mayor parte de la lógica de negocio reside en procedimientos almacenados (RPCs) dentro de PostgreSQL para garantizar la integridad transaccional independientemente del cliente.

## 2. Inteligencia de Negocio y Lógica Operativa (Core)

### A. Gestión de Turnos (Shift Logic)
El sistema opera sobre un modelo de turnos diario definido para la región **GMT-5 (Colombia)**.
- **Inicio de turno:** 16:00 (4:00 PM).
- **Fin de turno:** 04:00 AM del día siguiente.
- **Implementación técnica:** Todas las consultas (Dashboard/Reportería) calculan el inicio del turno (`v_shift_start`) ajustando el `now()` a las 21:00 UTC (equiv. 4 PM local). Si `now() < 16:00 local`, el turno activo es el del día anterior.

### B. Multi-Tienda (Multi-Store)
- Cada entidad transaccional (`orders`, `cash_register_closings`) está obligatoriamente vinculada a un `store_id`.
- Los catálogos (`products`, `categories`, `custom_options`, `extras`) utilizan un array de UUIDs (`store_ids[]`) para determinar la visibilidad en cada punto de venta.
- **Rutas de acceso:** El usuario se autentica, se resuelve su `store_id` (o se fuerza selección si es admin). Las políticas RLS filtran dinámicamente los datos basados en este `store_id` resuelto.

## 3. Infraestructura Técnica

### A. Base de Datos (PostgreSQL en Supabase)
- **RLS (Row Level Security):** Fundamental. La seguridad está delegada a nivel de tabla. Los usuarios (`authenticated`) solo pueden consultar datos donde su `store_id` coincida o si tienen rol `admin`.
- **Procedimientos Almacenados (RPCs):**
    - `create_order`: Valida tienda activa, disponibilidad de productos, cantidad y aplica reglas de negocio antes de la inserción.
    - `get_dashboard_stats` / `get_reporteria_stats`: Agregan datos complejos (ventas, pagos, ticket promedio) eficientemente en servidor.

### B. Integraciones (Siigo)
- **Flujo:** El cliente detecta pago requerido (`tarjeta`, `nequi`, `mixto`) -> Calcula configuración de facturas (`getInvoiceConfigs`) -> Invoca Edge Function.
- **Edge Function (`siigo-invoice`):**
    - Actúa como proxy seguro.
    - Gestiona el token de acceso de Siigo en memoria (cacheado) para no invocar auth en cada petición.
    - Implementa lógica de mapeo de tipos de pago a códigos internos de Siigo.
    - Registra el resultado en `siigo_invoices` (tracking de intentos/errores).

## 4. Arquitectura Frontend (React)

### A. Gestión de Estado y Flujo
1. **AuthProvider:** Autenticación + Carga de Perfil + Validación `is_active`.
2. **StoreProvider:** Resolución de `store_id` activo.
3. **OrderContext (Critical):**
    - Mantiene el estado en tiempo real (`subscribe` de Supabase).
    - **Offline Sync:** Cuando `navigator.onLine` es `false`, los pedidos se almacenan en una cola (`localStorage`). Se reintentan en cadena al recuperar conexión.
4. **TanStack Query:** Gestiona el cache de consultas (ej: productos, categorías) con `staleTime: 5m`, reduciendo carga en DB.

### B. UI/UX Patrones
- **Lazy Loading:** `App.tsx` utiliza `lazy` y `Suspense` para dividir los bundles por página.
- **Responsividad:** Componentes construidos con Tailwind CSS, adaptándose a tablets (Kiosko) y pantallas grandes (Dashboard/Admin).
- **Seguridad:** Los roles de usuario (`UserRole`) dictan el acceso a rutas y visualización de menús (`AppLayout.tsx`).

## 5. Tablas Maestras & Relaciones Clave

| Tabla | Propósito | Relación / Observaciones |
| :--- | :--- | :--- |
| `stores` | Puntos de venta | PK: `id` |
| `profiles` | Usuarios y Roles | FK: `store_id` -> `stores.id` |
| `orders` | Registro transaccional | FK: `store_id`, `created_by` |
| `products` | Catálogo | `store_ids[]` (GIN Index para búsqueda) |
| `payments` | Detalle financiero | FK: `order_id` |
| `siigo_invoices` | Tracking facturación | FK: `order_id` (1:1 o 1:N) |
