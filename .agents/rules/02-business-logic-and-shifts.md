# Regla 02: Lógica de Negocio, Turnos y Multi-Tienda

## 1. Gestión de Turnos (Shift Logic - GMT-5 Colombia)
* **Hora Base de Inicio de Turno:** 12:00 PM (Mediodía) configurada en `@/lib/shiftUtils.ts` (`SHIFT_START_HOUR = 12`).
* **Lógica Temporal:**
  * Si la hora actual es antes de las 12:00 PM, el turno activo comenzó ayer a las 12:00 PM.
  * Si la hora actual es mayor o igual a las 12:00 PM, el turno activo comenzó hoy a las 12:00 PM.
* **Consultas e Informes:** Todo cálculo de ventas del turno, arqueo o dashboard debe calcular el rango usando `getShiftStart()` y `getShiftEnd()`.

## 2. Modelo Multi-Tienda
* **Tablas Transaccionales (`orders`, `cash_register_closings`, `raw_material_entries`):** Tienen un campo `store_id UUID NOT NULL REFERENCES stores(id)`.
* **Catálogos (`products`, `categories`, `combos`, `coupons`):** Usan un array de UUIDs `store_ids UUID[]` para determinar en qué sedes están activos y visibles.
* **Resolución de Tienda:** El `StoreContext` resuelve la tienda según el perfil del usuario o la selección de un administrador en `/select-store` (persistido en `localStorage.la30_active_store`).
* **Sede Virtual de Domicilios:** La ruta `/domicilios` sólo debe ser accesible si la tienda activa tiene slug `'domicilios'`.

## 3. Resiliencia y Modo Offline
* En caso de pérdida de red (`navigator.onLine === false`), las órdenes se almacenan inmediatamente en `localStorage.getItem("la30_offline_orders_queue")`.
* La UI debe mostrar un badge de "Pendiente Offline" y sincronizar automáticamente cada elemento en cadena en cuanto se dispare el evento `window.addEventListener('online')`.

## 4. Manejo de Moneda y Precios
* Los precios se manejan en **pesos colombianos (COP) como enteros**. No usar floats ni decimales ($18,500 COP $\rightarrow$ `18500`).
* Para visualización de precios en la interfaz de usuario, usar siempre `@/lib/formatPrice.ts` (`formatPrice(amount)`).
