---
name: auth-and-multistore
description: Gestionar autenticación, roles de usuario, sistema multi-tienda y control de acceso en la30-front. Incluye RLS, allowed_store_ids, auto-logout y sesiones globales.
---

# Skill: Auth & Multi-Store

## Cuándo usar este skill
- Modificar flujo de autenticación.
- Agregar o cambiar roles de usuario.
- Ajustar lógica multi-tienda.
- Modificar políticas RLS.
- Gestionar control de acceso por ruta.

## Sistema de Autenticación

### Provider: AuthContext.tsx
Responsabilidades:
1. Login vía Supabase Auth (`signInWithPassword`).
2. Fetch de perfil desde tabla `profiles`.
3. Validación de `is_active` (usuarios desactivados no pueden acceder).
4. Auto-logout por inactividad (1 hora).
5. Logout global vía broadcast Realtime.
6. Listener de cambios de auth state (`onAuthStateChange`).

### Flujo de Login
```
1. User ingresa email + password
2. supabase.auth.signInWithPassword()
3. Si éxito → fetchProfile(userId)
4. Si profile.is_active === false → signOut + toast error
5. Si profile OK → setUser(profile) → redirect basado en rol
```

### Auto-logout
- Timer de 1 hora de inactividad.
- Eventos monitoreados: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `click`.
- Se reinicia con cualquier actividad del usuario.

### Logout Global
- Broadcast via Supabase Realtime canal `user-{userId}`.
- Evento: `global-logout`.
- Cierra sesión en TODOS los dispositivos.

## Roles de Usuario

Enum en PostgreSQL: `user_role`

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| `admin` | Todo | Administrador total |
| `caja` | Caja, Domicilios, Cocina, Mis Pedidos | Cajero |
| `mesero` | Kiosko, Mis Pedidos | Toma de pedidos |
| `cocina` | Cocina | Solo pantalla de cocina |
| `bodega` | Bodega (inventario) | Solo gestión de inventario |

### Control de acceso por ruta
```tsx
// En AppLayout.tsx → NAV_ITEMS
{ to: "/ruta", label: "Label", icon: Icon, roles: ["admin", "caja"] }
```

### En código
```typescript
import { useRequireRole } from "@/context/AuthContext";

function MyComponent() {
  const isAllowed = useRequireRole("admin", "caja");
  if (!isAllowed) return null;
  // ...
}
```

## Sistema Multi-Tienda

### Provider: StoreContext.tsx
Responsabilidades:
1. Fetch de todas las tiendas (`stores` table).
2. Filtrado de tiendas accesibles según `allowed_store_ids` o `store_id` del perfil.
3. Resolución de tienda activa (localStorage → primer tienda accesible).
4. Persistencia del slug de tienda activa en `la30_active_store`.

### Visibilidad de tiendas por usuario
```typescript
// Admin → todas las tiendas
// No-admin con allowed_store_ids → solo esas
// No-admin sin allowed_store_ids → solo su store_id
```

### Datos por tienda

**Tablas transaccionales** (tienen `store_id` único):
- `orders`, `payments`, `cash_register_closings`, `raw_materials`, `raw_material_entries`, `suppliers`, `raw_material_categories`

**Catálogos compartidos** (tienen `store_ids[]` array):
- `products`, `categories`, `product_custom_options`, `product_extras`

### Consulta con filtro de tienda
```typescript
// Transaccional
query.eq("store_id", activeStore.id);

// Catálogo compartido
query.contains("store_ids", [activeStore.id]);
```

### RPCs multi-tienda
Todas las RPCs principales aceptan `p_store_id UUID DEFAULT NULL`:
- Si se pasa → filtra por esa tienda.
- Si es NULL → usa el `store_id` del perfil del usuario autenticado.
- Si ambos son NULL → error.

## RLS (Row Level Security)

### Patrón estándar
```sql
-- Lectura para todos los autenticados
CREATE POLICY "tabla_select_authenticated" ON tabla
  FOR SELECT TO authenticated USING (true);

-- Todo para admin
CREATE POLICY "tabla_all_admin" ON tabla
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'admin')
  WITH CHECK (public.auth_user_role() = 'admin');
```

### Función helper RLS
```sql
-- Ya existe en la DB
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;
```

### Patrones avanzados de RLS
```sql
-- Filtro por store_id del usuario
CREATE POLICY "orders_select_own_store" ON orders
  FOR SELECT TO authenticated
  USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

## Tabla `profiles`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | FK → auth.users.id |
| `name` | text | Nombre del usuario |
| `email` | text | Email |
| `role` | user_role | Rol (admin/caja/mesero/cocina/bodega) |
| `avatar_url` | text? | URL de avatar |
| `is_active` | boolean | ¿Cuenta activa? |
| `store_id` | UUID? | Tienda principal (legacy) |
| `allowed_store_ids` | UUID[]? | Tiendas accesibles (nuevo) |

### Trigger de creación de usuario
```sql
-- handle_new_user() → se ejecuta al crear auth.user
-- Crea automáticamente un perfil con rol 'mesero' por defecto
```
