---
name: inventory-system
description: Gestionar el sistema de inventario de materia prima, recetas, proveedores y movimientos de stock del proyecto la30-front. Incluye CRUD completo, descuento automático por pedidos y alertas de stock bajo.
---

# Skill: Inventory System

## Cuándo usar este skill
- Modificar el sistema de inventario (materia prima, recetas, movimientos).
- Agregar funcionalidad al módulo de bodega.
- Cambiar lógica de descuento de stock.
- Gestionar proveedores.
- Implementar alertas de stock.

## Arquitectura del Inventario

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│ raw_materials    │◄────│ recipes      │────►│ products     │
│ (materia prima)  │     │ (producto →  │     │ (catálogo)   │
│ por tienda       │     │  materia p.) │     │              │
└────────┬────────┘     └──────────────┘     └──────────────┘
         │
    ┌────┴─────┐     ┌──────────────────┐
    │          │     │                  │
┌───▼──────┐ ┌▼─────▼──────┐  ┌────────▼────────┐
│ entries  │ │ movements   │  │ categories      │
│ (compras)│ │ (trazab.)   │  │ (clasificación) │
└──────────┘ └─────────────┘  └─────────────────┘
```

## Tablas

| Tabla | Propósito | FK/Relaciones |
|-------|-----------|---------------|
| `raw_material_categories` | Clasificación (Bebidas, Salsas, etc.) | `store_id → stores` |
| `raw_materials` | Catálogo de insumos | `store_id → stores`, `category_id → raw_material_categories` |
| `raw_material_entries` | Registro de compras | `raw_material_id → raw_materials`, `supplier_id → suppliers` |
| `recipes` | Receta: qué consume cada producto | `product_id → products`, `raw_material_id → raw_materials`, UNIQUE |
| `stock_movements` | Historial de movimientos | `raw_material_id`, `order_id`, `entry_id` |
| `suppliers` | Proveedores | `store_id → stores` |

## Flujo de Stock

### Entrada (compra de insumos)
```
1. addMaterialEntry() → INSERT raw_material_entries
2. Trigger trg_entry_stock_update → UPDATE raw_materials.current_stock += qty
3. Trigger → INSERT stock_movements (type: 'entry')
```

### Salida (venta de producto)
```
1. processPayment() → targetStatus = 'en_preparacion'
2. Fire-and-forget: deductStockFromOrder(orderId)
3. RPC recorre order_items → JOIN recipes → calcula consumo
4. UPDATE raw_materials.current_stock -= qty
5. INSERT stock_movements (type: 'order_deduction')
6. Si stock < 0 → agrega a low_stock_alerts
```

### Reglas críticas de stock
- **Stock negativo PERMITIDO**: Nunca bloquea ventas.
- **Idempotente**: Si ya se descontó para un pedido, no repite.
- **Fire-and-forget**: Errores de inventario NO bloquean el pago.
- **Productos sin receta**: Se ignoran silenciosamente.

## Servicio de Inventario

Archivo: `src/lib/inventoryService.ts`

### Funciones disponibles
```typescript
// Proveedores
getSuppliers(storeId)
createSupplier(payload)
updateSupplier(id, payload)
deactivateSupplier(id)
getSupplierPurchaseHistory(supplierId)

// Categorías
getMaterialCategories(storeId)
createMaterialCategory(payload)
updateMaterialCategory(id, payload)
deleteMaterialCategory(id)

// Materiales
getRawMaterials(storeId)        // Solo activos, con categoría
getAllRawMaterials(storeId)      // Incluye inactivos
createRawMaterial(input)
updateRawMaterial(id, updates)
deactivateRawMaterial(id)       // Soft-delete

// Entradas
addMaterialEntry(input)
getMaterialEntries(materialId, limit?)

// Recetas
getRecipesForProduct(productId)
upsertRecipe(input)             // CREATE OR UPDATE
deleteRecipe(productId, materialId)

// Stock
deductStockFromOrder(orderId)
getStockMovements(materialId, limit?)
getLowStockMaterials(storeId)
```

## Tipos de Inventario

Archivo: `src/types/inventory.types.ts`

Los tipos clave son:
- `RawMaterial` — con `current_stock` y `min_stock`
- `Recipe` / `RecipeWithMaterial` / `RecipeWithProduct`
- `StockMovement` — con `movement_type: 'order_deduction' | 'entry' | 'manual_adjustment'`
- `DeductStockResult` — retorno de la RPC con `low_stock_alerts`
- `RawMaterialWithAlert` — material con flag `is_low_stock`

## Componentes UI de Inventario

Ubicación: `src/components/inventory/`

| Componente | Descripción |
|-----------|-------------|
| `RawMaterialsTab.tsx` | CRUD de materia prima con categorías |
| `EntriesTab.tsx` | Registro de compras de insumos |
| `RecipesTab.tsx` | Asignación de recetas a productos |
| `MovementsTab.tsx` | Historial de movimientos de stock |
| `SuppliersTab.tsx` | Gestión de proveedores |

## Unidades de medida

Archivo: `src/lib/unitConversions.ts`

Unidades soportadas: `g`, `kg`, `lb`, `oz`, `ml`, `l`, `unidad`.
Se usan para la conversión entre unidades de compra y unidades de receta.
