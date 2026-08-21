---
name: release-version
description: Protocolo automatizado para registrar una nueva versión en la30-front, actualizar package.json, alternar tema visual del banner de novedades en el Dashboard, documentar changelog y avisar al usuario.
---

# Skill: Release Version & Dashboard Novelty Workflow

## Cuándo usar este skill
- Al finalizar un conjunto de cambios, módulo o refactorización antes de realizar `git commit` y `git push`.
- Cuando el usuario solicite explícitamente "crear versión", "subir versión", "hacer release" o registrar novedades.

---

## Flujo de Ejecución (4 Pasos Obligatorios)

```
┌─────────────────────────┐
│ 1. Subir Versión        │ ──► Incrementar semver en package.json
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ 2. Alternar Color Tema  │ ──► Escoger nuevo gradientTheme para el banner
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ 3. Registrar Novedad    │ ──► Agregar objeto en src/data/appUpdates.ts
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ 4. Commit y Notificar   │ ──► Conventional commit y avisar al usuario
└─────────────────────────┘
```

---

### Paso 1: Incrementar la Versión en `package.json`
Determinar el tipo de cambio:
- **Patch (`x.y.Z`)**: Correcciones de bugs, mejoras visuales menores, optimizaciones.
- **Minor (`x.Y.0`)**: Nuevos submódulos, nuevas pestañas, filtros avanzados o nuevas funcionalidades.
- **Major (`X.0.0`)**: Cambios de arquitectura, rediseño completo del sistema.

Editar `package.json`:
```json
"version": "2.1.19"
```

---

### Paso 2: Alternar el Color y Tema del Banner
En `src/data/appUpdates.ts`, alternar el `gradientTheme` respecto al anterior para que visualmente se distinga como una nueva versión fresca:

| Tema | Gradiente y Colores | Áreas / Módulos Sugeridos |
|---|---|---|
| `"purple"` | Púrpura / Índigo / Violeta | Domicilios, Liquidaciones, Cuadres de caja |
| `"sunset"` | Naranja / Ámbar / Rosa | Pedidos, Mesas, Cocina KDS, Catálogo |
| `"ocean"` | Azul / Índigo / Cyan | Reportería, Analítica, Métricas, Dashboard |
| `"emerald"` | Esmeralda / Teal / Verde | Facturación electrónica SIIGO, Pagos, Inventario |
| `"midnight"` | Slate / Zinc / Dark | Seguridad, Roles, Permisos, Infraestructura |

---

### Paso 3: Registrar la Novedad en `src/data/appUpdates.ts`
1. Asegurar que la versión anterior tenga su versión fija en string (ej. `version: "v2.1.18"`, `id: "update-2026-08-20-v2-1-18"`).
2. Insertar el nuevo registro al inicio de `APP_UPDATES`:

```typescript
export const APP_UPDATES: AppUpdate[] = [
  {
    id: `update-v${pkg.version}`,
    version: `v${pkg.version}`,
    date: "20 de Agosto, 2026", // Fecha actual legible
    isoDate: "2026-08-20",
    title: "Título de la Versión",
    subtitle: "Descripción corta en una o dos líneas.",
    badgeText: `🚀 v${pkg.version}`,
    badgeType: "purple", // "primary" | "emerald" | "amber" | "purple" | "rose"
    gradientTheme: "purple", // "purple" | "sunset" | "ocean" | "emerald" | "midnight"
    isMajor: true, // o false si es patch menor
    summary: "Resumen de alto nivel del valor entregado en esta versión.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Característica 1",
        description: "Detalle de la característica...",
        category: "feature", // "feature" | "improvement" | "fix" | "system"
        highlight: true,
      },
      {
        title: "Característica 2",
        description: "Detalle de la mejora...",
        category: "improvement",
      },
    ],
  },
  // ...versiones anteriores
];
```

---

### Paso 4: Validar, Commitear y Notificar
1. **Validación de Build:**
   ```bash
   npx tsc --noEmit
   ```
2. **Commit Convencional (Inglés):**
   ```bash
   git add package.json src/data/appUpdates.ts [archivos_modificados]
   git commit -m "feat(scope): brief summary and bump version to X.Y.Z"
   ```
3. **Respuesta al Usuario:**
   Informar claramente:
   - Versión generada (`vX.Y.Z`).
   - Color / tema asignado al banner del Dashboard.
   - Puntos clave incluidos en el poster de novedades.
