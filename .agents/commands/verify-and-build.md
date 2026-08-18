# Comando: Verificación, Linter y Compilación (`verify-and-build`)

## Instrucción para el Agente
> "Valida la integridad del código fuente, ejecuta las revisiones de TypeScript y comprueba la compilación de producción con Vite."

### Comandos de Validación Local:

1. **Chequeo de Linter y Reglas:**
   ```bash
   pnpm lint
   ```
2. **Chequeo de Tipos de TypeScript:**
   ```bash
   npx tsc --noEmit
   ```
3. **Build de Producción:**
   ```bash
   pnpm build
   ```

### Criterios de Aceptación:
* `pnpm lint` termina con código `0` sin errores.
* `pnpm build` genera el bundle en `dist/` sin advertencias críticas de dependencias circulares o tipos rotos.
