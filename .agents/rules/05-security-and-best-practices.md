# Regla 05: Seguridad, Roles y Buenas Prácticas

## 1. Roles de Usuario y Control de Acceso
Los roles disponibles en el sistema (`UserRole`) son:
* `admin`: Acceso irrestricto a todas las sedes, dashboards, reportería, usuarios, configuración de app y bodega.
* `caja`: Acceso a cobros, arqueo de caja, pantalla de domicilios y cocina.
* `cocina`: Acceso a pantalla KDS de comandas en preparación.
* `mesero`: Acceso a toma de órdenes en Kiosko y seguimiento de "Mis Pedidos".
* `bodega`: Acceso al módulo de compras, materias primas y recetas técnicas.

## 2. Manejo de Secretos y API Keys
* **Prohibido en Frontend:** La `SUPABASE_SERVICE_ROLE_KEY` o cualquier credencial con privilegios de superusuario **NUNCA** debe importarse, inyectarse o utilizarse en el código cliente de React.
* **Uso Exclusivo:** El frontend únicamente utiliza `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
* Las operaciones privilegiadas (generación de tokens Siigo, webhooks Wompi, etc.) deben ejecutarse exclusivamente dentro de **Edge Functions** (`supabase/functions/`).

## 3. Filosofía de Inventario y Operación
* **Política de Stock Negativo:** En la operación de un restaurante de comida rápida, un desbalance transitorio en el inventario no debe detener el servicio. Si una receta o producto no tiene stock suficiente registrado en la tabla `raw_materials`, el sistema descuenta y permite saldo negativo, alertando visualmente en el módulo de Bodega sin bloquear el cobro.

## 4. Control de Sesiones
* La función RPC `has_other_sessions` y los triggers de autenticación ayudan a detectar inicios de sesión concurrentes no autorizados en terminales de caja.
