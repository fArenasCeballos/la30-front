# Comando: Prueba del Modo Offline (`test-offline-sync`)

## Instrucción para el Agente
> "Guía de verificación y prueba para el comportamiento sin conexión (Offline-First) y re-sincronización de pedidos."

### Procedimiento de Prueba Manual / Simulación:

1. **Abrir Kiosko o Caja:**
   * Navegar a `/kiosko` o `/caja`.
2. **Simular Desconexión:**
   * Abrir DevTools del navegador $\rightarrow$ Pestaña **Network** $\rightarrow$ Seleccionar **Offline**.
   * O ejecutar en consola: `window.dispatchEvent(new Event('offline'))`.
3. **Crear Orden:**
   * Agregar productos al carrito y confirmar pedido.
   * Verificar que aparezca el banner o toast de *Orden guardada localmente (Modo Offline)*.
   * Inspeccionar que `localStorage.getItem('la30_offline_orders_queue')` contenga el objeto de la orden serializado.
4. **Restablecer Conexión:**
   * Cambiar Network en DevTools a **No throttling** (Online).
   * O ejecutar en consola: `window.dispatchEvent(new Event('online'))`.
5. **Verificación de Sincronización:**
   * Comprobar que la cola se procese y se vacíe en `localStorage`.
   * Verificar en Supabase (`orders` y `order_items`) que el pedido se haya insertado con su `ticket_number` y estado correcto.
