---
name: code-quality-and-testing
description: >-
  Guía estricta y runbook para verificación de tipos con TypeScript, validación de ESLint,
  ejecución de pruebas unitarias con Vitest y compilación de producción en la30-front.
  Usar siempre antes de dar por terminado cualquier cambio o refactor en el código.
---

# Skill: Calidad de Código, Linting y Testing

## Cuándo usar este skill
* Siempre que se complete la implementación o refactorización de una funcionalidad.
* Antes de hacer merge, commit o entregar código al usuario.
* Cuando se detecten advertencias o errores de compilación en el IDE o consola.

---

## Pipeline de Validación Estricta

Ejecuta el pipeline completo con:
```bash
pnpm validate
```

O paso a paso de forma granular:

### 1. Verificación de Tipos (TypeScript)
```bash
pnpm typecheck
```
* **Qué valida:** Que no existan incoherencias de tipos, propiedades inexistentes en modelos, o incompatibilidad de parámetros en llamadas a Supabase/RPCs.
* **Acción si falla:** Corregir los tipos en `src/types/index.ts` o refactorizar el código para cumplir con las interfaces generadas. Prohibido usar `any` como parche.

### 2. Análisis Estático (ESLint)
```bash
pnpm lint
```
* **Qué valida:** Reglas de React Hooks, exports limpios para Fast Refresh, sintaxis de Tailwind y ausencia de variables no utilizadas.
* **Acción si falla:** Ajustar dependencias en hooks `useEffect`/`useCallback` o limpiar imports huérfanos.

### 3. Ejecución de Pruebas Unitarias (Vitest)
```bash
pnpm test
```
* **Qué valida:** Correcto funcionamiento de la lógica matemática de turnos, formatos monetarios, parsing de tickets e inventario.
* **Para desarrollo continuo interactivo:**
  ```bash
  pnpm test:watch
  ```

### 4. Build de Producción (Vite)
```bash
pnpm build
```
* **Qué valida:** Que el empaquetador de Vite compile todos los chunks, lazy-loadings y estilos CSS sin errores.

---

## Cómo Escribir Nuevas Pruebas Unitarias

Crea los archivos de prueba en `src/lib/__tests__/[nombre].test.ts` o junto al componente `[Nombre].test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { miFuncion } from "../miModulo";

describe("miModulo", () => {
  it("debe retornar el resultado esperado para el caso base", () => {
    const resultado = miFuncion(100);
    expect(resultado).toBe(true);
  });

  it("debe manejar casos borde y valores nulos sin romperse", () => {
    expect(() => miFuncion(null as any)).not.toThrow();
  });
});
```
