---
name: reporting-and-dashboard
description: Modificar o crear funcionalidades de reportería, dashboard de KPIs, cierres de caja y exportaciones Excel en la30-front. Incluye RPCs de agregación y lógica de turnos.
---

# Skill: Reporting & Dashboard

## Cuándo usar este skill
- Agregar nuevos KPIs al dashboard.
- Modificar reportería o agregar nuevos reportes.
- Cambiar lógica de cierres de caja.
- Ajustar cálculos financieros.
- Agregar exportaciones (Excel, PDF).

## Archivos clave

| Archivo | Tamaño | Responsabilidad |
|---------|--------|----------------|
| `src/pages/Dashboard.tsx` | 20KB | KPIs del turno actual |
| `src/pages/Reporteria.tsx` | 89KB | Reportes con rangos de fecha (está como tab en Administración) |
| `src/pages/Consultas.tsx` | 34KB | Consulta de pedidos históricos (tab en Administración) |
| `src/lib/shiftUtils.ts` | 2KB | Cálculos de turno |
| `src/components/ReportLoadingModal.tsx` | 7KB | Modal de carga durante generación de reportes |

## Lógica de Turnos

```typescript
// src/lib/shiftUtils.ts
SHIFT_START_HOUR = 12; // 12 PM (mediodía)

getShiftStart(date?)     // Inicio del turno actual
getShiftEnd(date?)       // Fin del turno (24h después)
getShiftRange(offset?)   // Rango {from, to} con offset en días
getCalendarShiftRange(from, to?)  // Rango para selección de calendario
```

> ⚠️ **DISCREPANCIA CONOCIDA**: Las RPCs de PostgreSQL (`get_dashboard_stats`, `get_top_products`) usan 16:00 (4PM) como inicio de turno. El frontend usa 12:00 (mediodía). Al crear NUEVAS RPCs, usa 12PM para ser consistente con el frontend.

## RPCs de Reportería

### `get_dashboard_stats(p_store_id UUID)`
Retorna JSON con:
- `total_revenue`: Ventas totales (solo entregados)
- `active_orders`: Pedidos activos
- `completed_today`: Entregados hoy
- `cancelled_today`: Cancelados hoy
- `avg_ticket`: Ticket promedio
- `cash_total`: Total en efectivo
- `card_total`: Total en tarjeta
- `nequi_total`: Total en nequi/transferencia

### `get_top_products(p_limit, p_store_id)`
Retorna TABLE con:
- `product_name`, `category`, `quantity`, `revenue`

### `get_reporteria_stats(p_from, p_to, p_store_id)`
Retorna estadísticas para un rango de fechas personalizado.

### `generate_cash_closing(p_period_start, p_period_end, p_notes, p_store_id)`
Genera cierre de caja con totales desglosados y lo almacena en `cash_register_closings`.

## Desglose de pagos en reportes

La lógica de desglose para pagos mixtos es consistente en todas las RPCs:
```sql
-- Efectivo
CASE WHEN p.method = 'efectivo' THEN p.amount_total
     WHEN p.method = 'mixto' THEN p.amount_efectivo
     ELSE 0 END

-- Tarjeta
CASE WHEN p.method = 'tarjeta' THEN p.amount_total
     WHEN p.method = 'mixto' THEN p.amount_tarjeta
     ELSE 0 END

-- Nequi/Transfer
CASE WHEN p.method = 'nequi' THEN p.amount_total
     WHEN p.method = 'mixto' THEN p.amount_nequi
     ELSE 0 END
```

## Exportación a Excel

Librerías: `exceljs` + `file-saver` + `xlsx`

Patrón en Reporteria.tsx:
```typescript
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Reporte");
// ... agregar columnas, filas, estilos
const buffer = await workbook.xlsx.writeBuffer();
saveAs(new Blob([buffer]), `reporte_${fecha}.xlsx`);
```

## Gráficos

Librería: `recharts`

Componentes usados: `BarChart`, `LineChart`, `PieChart`, `ResponsiveContainer`, `Tooltip`, `Legend`.

Patrón:
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chartData}>
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip formatter={(v) => formatPrice(v)} />
    <Bar dataKey="revenue" fill="#F97316" />
  </BarChart>
</ResponsiveContainer>
```

## Formato de Precios

```typescript
// src/lib/formatPrice.ts
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
```

Los precios se almacenan como **enteros** en COP (sin decimales). Ejemplo: $25,000 → `25000`.
