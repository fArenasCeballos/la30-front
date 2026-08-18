# Comando: Diagnosticar y Depurar Incidencias (`debug-issue`)

## Instrucción para el Agente
> "Investiga y soluciona un error en `la30-front`. Aplica un análisis sistemático antes de realizar cambios de código."

### Áreas Frecuentes de Diagnóstico:

1. **Permisos y Políticas RLS:**
   * ¿El usuario autenticado tiene el `store_id` correcto en `profiles`?
   * ¿La política RLS de la tabla bloquea SELECT o INSERT para el rol actual?
2. **Sincronización en Tiempo Real y Estado:**
   * ¿El canal WebSocket de Supabase en `OrderContext` está suscrito a la tabla correspondiente?
   * ¿Las invalidaciones de TanStack Query (`queryClient.invalidateQueries`) se están ejecutando tras mutaciones?
3. **Cálculo de Turnos y Rango de Fechas:**
   * Revisar si la discrepancia ocurre antes de las 12:00 PM (GMT-5) y cómo `getShiftStart()` ajusta el rango.
4. **Facturación Siigo:**
   * Verificar en la tabla `siigo_invoices` el `error_message` y el payload de respuesta de la Edge Function.
5. **Cola Offline:**
   * Inspeccionar `localStorage.getItem('la30_offline_orders_queue')` para verificar si hay órdenes atascadas por validación fallida.
