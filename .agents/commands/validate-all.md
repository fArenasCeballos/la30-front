# Comando: Validación Total Obligatoria (`validate-all`)

## Instrucción para el Agente
> "Ejecuta el protocolo de validación exhaustiva de calidad: TypeScript Typecheck, ESLint, Tests con Vitest y Build de Producción. Si algún chequeo arroja un error, identifícalo, resuélvelo de raíz y repite la prueba hasta que todo el pipeline pase en verde."

### Secuencia de Comandos:

```bash
# 1. Chequeo de Tipos Estricto
pnpm typecheck

# 2. Análisis Estático con ESLint
pnpm lint

# 3. Pruebas Unitarias
pnpm test

# 4. Compilación del Bundle Final
pnpm build
```

### Criterios de Aprobación Inviolables:
* ✅ `pnpm typecheck`: Exit code 0, 0 errores.
* ✅ `pnpm lint`: Exit code 0, 0 errores.
* ✅ `pnpm test`: Exit code 0, 100% de los tests pasando.
* ✅ `pnpm build`: Bundle generado exitosamente en `dist/`.
