---
name: order-management
description: Gestionar el ciclo de vida completo de pedidos en la30-front. Incluye creación, actualización de status, soporte offline, suscripciones Realtime, pedidos de domicilio y optimistic updates.
---

# Skill: Order Management

## Cuándo usar este skill
- Modificar el flujo de creación de pedidos.
- Cambiar estados o transiciones de pedidos.
- Ajustar soporte offline.
- Modificar suscripciones Realtime.
- Agregar funcionalidad a domicilios.

## Pipeline de Estados

```
pendiente ──► confirmado ──► en_preparacion ──► listo ──► entregado
    │                                            │
    └──────────────────► cancelado ◄─────────────┘
```

### Transiciones por rol
| Transición | Quién la ejecuta | Cómo |
|-----------|------------------|------|
| → pendiente | Mesero/Caja (addOrder) | RPC `create_order` |
| pendiente → confirmado | Caja | `updateOrderStatus()` |
| → en_preparacion | Caja (post-pago) | `processPayment()` |
| en_preparacion → listo | Cocina | `updateOrderStatus()` |
| listo → entregado | Caja/Mesero | `updateOrderStatus()` |
| cualquiera → cancelado | Admin/Caja | `updateOrderStatus()` |

## Archivo Central: OrderContext.tsx

### Queries
```typescript
// 1. orders — Todos los del turno (para Dashboard/Reportería)
queryKey: ["orders", userId, storeId]
staleTime: 1 min

// 2. activeOrders — Solo pendiente/confirmado/en_preparacion/listo (Cocina/Caja)
queryKey: ["active-orders", userId, storeId]
staleTime: 30 seg
```

### Realtime
```typescript
// Canal: "orders-realtime-speed"
// Escucha: orders (INSERT/UPDATE/DELETE) + order_items (*)
// UPDATE → optimistic inline update (no refetch)
// INSERT/DELETE → debounced invalidation (300ms)
```

### Funciones principales
| Función | Descripción |
|---------|-------------|
| `addOrder()` | Pedido estándar con soporte offline |
| `addDeliveryOrder()` | Pedido de domicilio (delivery_*) |
| `updateOrder()` | Modifica items de un pedido existente |
| `updateOrderStatus()` | Cambia estado con optimistic update |
| `dispatchOrder()` | Marca domicilio como despachado |
| `toggleOrderItem()` | Toggle de item completado (cocina) |
| `processPayment()` | Registra pago + cambia status + descuenta stock |
| `getOrdersByStatus()` | Filtra activeOrders por status |
| `getCompletedOrders()` | Filtra orders entregados/cancelados |

## Soporte Offline

### Cola de pedidos offline
```typescript
// localStorage key: "la30_offline_orders_queue"
// Tipo: OfflineOrderQueueItem[]
interface OfflineOrderQueueItem {
  id: string;
  type: "standard" | "delivery";
  locator: string;
  items: OrderItemInput[];
  notes?: string;
  deliveryInfo?: { name, address, phone, fee };
  order: Order; // Datos optimistas para UI
}
```

### Sincronización
1. `navigator.onLine === false` → guardar en cola local.
2. Listener `window.addEventListener("online", syncOfflineQueue)`.
3. Polling cada 30s como respaldo.
4. Los pedidos offline se muestran con `isOfflinePending: true` en la UI.
5. Flag `_isSyncingOrders` en window previene sincronizaciones concurrentes.

## Domicilios

### Campos en `orders`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `is_delivery` | boolean | ¿Es domicilio? |
| `delivery_name` | text | Nombre del cliente |
| `delivery_address` | text | Dirección de entrega |
| `delivery_phone` | text | Teléfono |
| `delivery_fee` | integer | Costo del domicilio |
| `driver_id` | UUID | Domiciliario asignado |
| `is_dispatched` | boolean | ¿Ya fue despachado? |

### Tabla `delivery_drivers`
| Campo | Tipo |
|-------|------|
| `first_name` | text |
| `last_name` | text |
| `phone` | text |
| `motorcycle_plate` | text |
| `is_active` | boolean |

### Tabla `delivery_zones`
| Campo | Tipo |
|-------|------|
| `name` | text |
| `price` | integer (COP) |
| `polygon` | JSONB (LatLngPoint[][]) |
| `color` | text (hex) |
| `is_active` | boolean |

## Optimistic Updates Pattern
Todas las operaciones de escritura siguen el patrón:
1. Guardar snapshot previo del caché.
2. Actualizar caché inmediatamente (UI se actualiza al instante).
3. Ejecutar la mutación real en Supabase.
4. Si error → rollback al snapshot + toast de error.
5. Si éxito → toast de confirmación.
