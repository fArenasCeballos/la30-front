---
name: debugging
description: Diagnosticar y resolver bugs en la30-front. Incluye patrones comunes de errores, técnicas de debugging para Supabase, React Context, TanStack Query, Realtime y problemas de cálculos financieros.
---

# Skill: Debugging & Troubleshooting

## Cuándo usar este skill
- Diagnosticar bugs reportados por el usuario.
- Resolver discrepancias en cálculos financieros.
- Debuggear problemas de Realtime/sincronización.
- Investigar errores de Supabase (RLS, RPCs, Edge Functions).

## Checklist de Diagnóstico

### 1. ¿Es un problema de datos o de UI?
- Revisar la tabla en Supabase Dashboard directamente.
- Comparar datos en DB vs lo que muestra la UI.
- Verificar si el `store_id` correcto está siendo usado.

### 2. ¿Es un problema de turno?
- ⚠️ El frontend usa `SHIFT_START_HOUR = 12` (mediodía).
- Las RPCs antiguas usan `INTERVAL '16 hours'` (4PM).
- Verificar si el pedido está dentro del rango correcto del turno.

### 3. ¿Es un problema de caché?
```typescript
// Invalidar caché manualmente
queryClient.invalidateQueries({ queryKey: ["orders", userId, storeId] });
queryClient.invalidateQueries({ queryKey: ["active-orders", userId, storeId] });
```

### 4. ¿Es un problema de Realtime?
- Verificar que el canal `orders-realtime-speed` esté suscrito.
- Los UPDATE se manejan inline (sin refetch).
- INSERT/DELETE usan invalidación con debounce de 300ms.

## Problemas Comunes

### Tirilla no coincide con dashboard
**Causa**: La tirilla usa datos de la orden individual. El dashboard agrega datos del turno.
**Verificar**: 
- Que `payments.amount_efectivo/tarjeta/nequi` tenga los valores correctos.
- Que la RPC de dashboard agrupe correctamente efectivo/tarjeta/nequi de pagos mixtos.

### Pedidos no aparecen en cocina
**Posibles causas**:
1. `store_id` del pedido no coincide con la tienda activa del usuario cocina.
2. El pedido está fuera del rango del turno actual.
3. El canal Realtime no está activo (verificar pestaña de red).

### Factura Siigo falla
**Verificar en orden**:
1. ¿VITE_SIIGO_ENABLED = "true"?
2. ¿La Edge Function tiene las env vars (SIIGO_USERNAME, SIIGO_ACCESS_KEY)?
3. Revisar `siigo_invoices` table para el error_message.
4. ¿Los productos tienen `siigo_code` asignado?
5. ¿La suma de `price * quantity` de items coincide EXACTAMENTE con el total?

### Stock negativo inesperado
**Es comportamiento esperado** — el sistema permite stock negativo para no bloquear ventas.
**Verificar**:
1. Que las recetas (`recipes`) tengan cantidades correctas.
2. Revisar `stock_movements` para trazabilidad.
3. Verificar que no se haya descontado duplicado (la RPC es idempotente por `order_id`).

### Error "Sin permisos para crear pedidos"
- El usuario debe tener rol `admin`, `mesero` o `caja`.
- El perfil debe tener `is_active = true`.
- Verificar en `profiles` table.

### Pedido offline no se sincroniza
1. Verificar `localStorage` → key `la30_offline_orders_queue`.
2. ¿El navegador reporta `navigator.onLine === true`?
3. ¿La tienda activa tiene el mismo `store_id` que cuando se creó el pedido offline?
4. Verificar flag `window._isSyncingOrders`.

## Herramientas de Debug

### Queries en Supabase SQL Editor
```sql
-- Pedidos del turno actual
SELECT * FROM orders 
WHERE created_at >= (CASE 
  WHEN CURRENT_TIME >= '12:00:00' THEN CURRENT_DATE + INTERVAL '12 hours'
  ELSE CURRENT_DATE - INTERVAL '12 hours'
END)
ORDER BY created_at DESC;

-- Pagos con desglose
SELECT o.locator, p.method, p.amount_total, p.amount_efectivo, p.amount_tarjeta, p.amount_nequi
FROM payments p JOIN orders o ON o.id = p.order_id
WHERE o.created_at >= CURRENT_DATE
ORDER BY o.created_at DESC;

-- Estado de facturación
SELECT o.locator, si.status, si.error_message, si.payment_method
FROM siigo_invoices si JOIN orders o ON o.id = si.order_id
WHERE si.created_at >= CURRENT_DATE
ORDER BY si.created_at DESC;

-- Stock de materia prima con alertas
SELECT name, unit, current_stock, min_stock,
  CASE WHEN current_stock <= min_stock THEN '⚠️ BAJO' ELSE '✅ OK' END as status
FROM raw_materials WHERE store_id = 'UUID' AND is_active = true
ORDER BY current_stock ASC;
```

### Console debugging
```typescript
// En OrderContext, agregar temporalmente:
console.log("[OrderContext] storeId:", storeId);
console.log("[OrderContext] orders count:", orders.length);
console.log("[OrderContext] activeOrders count:", activeOrders.length);
```

### Verificar RLS
```sql
-- Como servie_role, verificar qué políticas están activas
SELECT * FROM pg_policies WHERE tablename = 'orders';
```
