# Comando: Lanzamiento de Versión y Novedad (`release-version`)

## Instrucción para el Agente
> "Vas a preparar y documentar un nuevo lanzamiento de versión para `la30-front`. Ejecuta obligatoriamente los 4 pasos antes de commitear y notificar al usuario."

### Pasos de Ejecución Obligatorios:
1. **Incrementar Versión en `package.json`:**
   * Evaluar cambios (patch/minor/major) y actualizar el campo `"version"`.
2. **Alternar Color y Tema del Banner (`src/data/appUpdates.ts`):**
   * Elegir un `gradientTheme` diferente a la versión previa (`purple`, `sunset`, `ocean`, `emerald`, `midnight`).
   * Configurar `badgeType` acorde.
3. **Documentar Novedades en `src/data/appUpdates.ts`:**
   * Agregar el objeto con `id: update-v${pkg.version}`, título, subtítulo, resumen y lista de items clasificados (`feature`, `improvement`, `fix`, `system`).
   * Asegurar persistencia estática de las versiones anteriores.
4. **Verificación y Commit:**
   * Ejecutar `npx tsc --noEmit`.
   * Realizar commit convencional en inglés.
   * Avisar al usuario con el resumen de la versión y tema seleccionado.
