# Regla 07: Protocolo Obligatorio de Nueva Versión y Lanzamiento

Antes de realizar `git commit` y `git push` de cambios significativos, correcciones o nuevas funcionalidades, es **OBLIGATORIO** ejecutar el siguiente protocolo de 4 pasos:

---

## 1. Incrementar la Versión en `package.json`
* Incrementar la versión siguiendo **SemVer**:
  * **Patch (`x.y.Z`)**: Para correcciones de errores (*bug fixes*), mejoras menores de UI o ajustes de configuración.
  * **Minor (`x.Y.0`)**: Para nuevas características, nuevas pantallas, nuevos submódulos o cambios funcionales sustanciales.
  * **Major (`X.0.0`)**: Para cambios arquitecturales profundos o rediseños globales.

---

## 2. Alternar el Color y Tema del Banner de Novedades
* El banner del Dashboard y el modal de novedades deben cambiar de color respecto a la versión anterior para que el usuario perciba de inmediato que hay una actualización fresca.
* Paletas disponibles en `gradientTheme` (`src/data/appUpdates.ts`):
  * `"purple"`: Púrpura / Índigo / Violeta (ideal para Domicilios, finanzas, liquidaciones).
  * `"sunset"`: Naranja / Ámbar / Rosa (ideal para pedidos, mesas, cocina).
  * `"ocean"`: Azul / Índigo / Cyan (ideal para analítica, reportería, sincronización).
  * `"emerald"`: Esmeralda / Teal / Verde (ideal para facturación electrónica, pagos, inventario).
  * `"midnight"`: Slate / Zinc / Dark (ideal para seguridad, roles, configuraciones técnicas).
* Ajustar también `badgeType` (`"purple"` | `"primary"` | `"emerald"` | `"amber"` | `"rose"`).

---

## 3. Registrar las Nuevas Características en `src/data/appUpdates.ts`
* Agregar un nuevo objeto al inicio del array `APP_UPDATES`:
  ```typescript
  {
    id: `update-v${pkg.version}`,
    version: `v${pkg.version}`,
    date: "DD de Mes, YYYY", // Fecha en español legible
    isoDate: "YYYY-MM-DD",
    title: "Título Impactante y Claro",
    subtitle: "Subtítulo explicativo en 1-2 líneas.",
    badgeText: "🚀 vX.Y.Z",
    badgeType: "purple", // o "primary", "emerald", "amber", "rose"
    gradientTheme: "purple", // o "sunset", "ocean", "emerald", "midnight"
    isMajor: true,
    summary: "Resumen ejecutivo de los cambios implementados y su impacto.",
    author: "Equipo de Desarrollo",
    items: [
      {
        title: "Nombre del cambio o función",
        description: "Explicación clara de qué hace y cómo beneficia al usuario.",
        category: "feature" | "improvement" | "fix" | "system",
        highlight: true,
      },
    ],
  },
  ```
* Asegurarse de que el elemento anterior en `APP_UPDATES` conserve su versión e id histórico estático (ej. `id: "update-2026-08-20-v2-1-18"`, `version: "v2.1.18"`).

---

## 4. Avisar al Usuario y Confirmar el Lanzamiento
* Al finalizar el commit y push, notificar explícitamente al usuario en el mensaje de respuesta:
  * Número de versión publicada (`vX.Y.Z`).
  * Tema de color aplicado al banner.
  * Resumen de las novedades visibles en el Dashboard.
  * Mensaje del commit convencional generado.
