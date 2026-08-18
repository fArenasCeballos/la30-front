# Regla 06: Calidad de Código Estricta, ESLint, TypeScript y Pruebas

> ⛔ **POLÍTICA DE TOLERANCIA CERO (ZERO BROKEN BUILDS):** Ningún agente de IA ni desarrollador puede dar por concluida una tarea si existe un solo error en TypeScript, una violación de ESLint o una prueba unitaria fallida.

---

## 1. Verificación Obligatoria Antes de Finalizar

Todo cambio en el código debe superar obligatoriamente la suite de validación:

```bash
pnpm validate
# Equivale a: pnpm typecheck && pnpm lint && pnpm test
```

Si cualquiera de estos tres comandos falla, el agente **DEBE** corregir el problema inmediatamente antes de responder al usuario.

---

## 2. Estándares Estrictos de TypeScript
1. **Tipado Estricto (No `any` indiscriminado):**
   * Queda terminantemente prohibido usar `any` para omitir errores de tipos.
   * Utilizar `unknown` con type guards (`typeof`, `instanceof`, `zod`) o interfaces explícitas.
2. **Tipos de Base de Datos:**
   * Importar tipos de tablas y enums desde `@/types` o `@/types/database.types.ts`.
   * **NUNCA** modificar `database.types.ts` a mano; usar `supabase gen types`.
3. **Chequeo de Tipos en Terminal:**
   ```bash
   pnpm typecheck # tsc --noEmit
   ```
   Debe terminar con código de salida `0` y cero diagnósticos de error.

---

## 3. Estándares Estrictos de ESLint
1. **Reglas de React Hooks:**
   * Respetar rigurosamente el array de dependencias en `useEffect`, `useCallback` y `useMemo`.
   * Prohibido desactivar `react-hooks/exhaustive-deps` con `// eslint-disable-next-line` a menos que se justifique con un comentario explícito sobre la razón técnica.
2. **Fast Refresh:**
   * Los archivos en `src/components/` o `src/pages/` deben exportar componentes limpios. Funciones auxiliares o constantes reutilizables deben residir en `src/lib/` o en un archivo independiente.
3. **Variables y Funciones sin Uso:**
   * Prohibido dejar imports o variables muertas (`no-unused-vars`).

---

## 4. Estándares Estrictos de Pruebas (Testing con Vitest)
1. **Cobertura de Lógica Crítica:**
   * Todo nuevo servicio o función en `src/lib/` que involucre:
     * Cálculos monetarios o split de pagos (`formatPrice`, `processPayment`).
     * Cálculo y conversiones de turnos y fechas (`shiftUtils`).
     * Deducción de stock y recetas (`inventoryService`).
     * Transformación de payloads contables (`siigoService`).
   * **DEBE** contar con su respectivo archivo de pruebas en `src/lib/__tests__/[nombre].test.ts`.
2. **Ejecución Rápida y Determinística:**
   * Los tests deben ser unitarios, determinísticos y no depender de llamadas de red reales a servidores externos (usar mocks de Supabase si aplica).
   * Ejecución: `pnpm test` (`vitest run`).

---

## 5. Compilación y Build
* Antes de entregar cambios arquitectónicos o de dependencias, validar que Vite genere el bundle de producción sin fallos:
  ```bash
  pnpm build
  ```
