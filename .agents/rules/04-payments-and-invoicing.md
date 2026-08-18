# Regla 04: Pagos, Facturación Electrónica e Impresión Térmica

## 1. Métodos de Pago Válidos
El sistema reconoce los siguientes métodos en el enum `payment_method`:
* `efectivo`
* `tarjeta` / `tarjeta_debito` / `tarjeta_credito`
* `nequi`
* `daviplata`
* `mixto` (combinación de dos o más métodos de pago)

## 2. Facturación Electrónica con Siigo
* **Cuándo se Factura:** Todo pago que incluya medios electrónicos (`tarjeta`, `nequi`, `daviplata` o split mixto con estos) debe registrar factura en Siigo a través del servicio `@/lib/siigoService.ts` y la Edge Function `siigo-invoice`.
* **Pagos en Efectivo Puro:** Por regla contable del negocio, los pagos 100% en efectivo no disparan factura electrónica obligatoria, pero sí imprimen comanda y recibo de caja.
* **Manejo de Errores en Facturación:** Si la API de Siigo falla o no responde, el pago local del pedido **NO** debe anularse ni bloquearse. El registro de error se guarda en `siigo_invoices` con estado `'error'` para permitir reintentos manuales desde la vista de consultas o reportes.

## 3. Impresión Térmica de Recibos
* Utilizar las funciones de `@/lib/receiptUtils.ts`:
  * `buildCustomerReceiptHTML(data)`: Recibo final para el cliente con desglose de ítems, totales, método de pago y datos de sede.
  * `buildKitchenReceiptHTML(data)`: Comanda para cocina con notas especiales y personalizaciones.
  * `buildShiftClosingReceiptHTML(data)`: Resumen del turno para arqueo de caja física.
* La impresión se realiza en modo silencioso o diálogo directo mediante un iframe oculto dinámico (`silentPrint(html)`). Formato adaptado a impresoras de 80mm o 58mm.
