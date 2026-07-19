/**
 * Motor de Conversión de Unidades para Bodega General
 * 
 * Basado en un enfoque de "Unidad Base". Toda la matemática en el backend 
 * (stock actual, costo, deducción) se procesa en la unidad base (g, ml, u).
 * Las equivalencias se usan en la UI para facilitar el registro de compras o recetas.
 */

export type DimensionType = "mass" | "volume" | "count";

export interface UnitDefinition {
  id: string;
  label: string;
  short: string;
  dimension: DimensionType;
  /** Multiplicador para convertir ESTA unidad a la unidad BASE de su dimensión */
  multiplierToBase: number; 
  isBase: boolean;
}

export const UNITS: Record<string, UnitDefinition> = {
  // ─── MASA (Base: Gramos) ───────────────────────────
  g: {
    id: "g",
    label: "Gramos",
    short: "g",
    dimension: "mass",
    multiplierToBase: 1,
    isBase: true,
  },
  kg: {
    id: "kg",
    label: "Kilogramos",
    short: "kg",
    dimension: "mass",
    multiplierToBase: 1000,
    isBase: false,
  },
  lb: {
    id: "lb",
    label: "Libras",
    short: "lb",
    dimension: "mass",
    multiplierToBase: 453.592,
    isBase: false,
  },
  oz: {
    id: "oz",
    label: "Onzas",
    short: "oz",
    dimension: "mass",
    multiplierToBase: 28.3495,
    isBase: false,
  },
  ton: {
    id: "ton",
    label: "Toneladas",
    short: "t",
    dimension: "mass",
    multiplierToBase: 1000000,
    isBase: false,
  },

  // ─── VOLUMEN (Base: Mililitros) ────────────────────
  ml: {
    id: "ml",
    label: "Mililitros",
    short: "ml",
    dimension: "volume",
    multiplierToBase: 1,
    isBase: true,
  },
  l: {
    id: "l",
    label: "Litros",
    short: "L",
    dimension: "volume",
    multiplierToBase: 1000,
    isBase: false,
  },
  gal: {
    id: "gal",
    label: "Galones",
    short: "gal",
    dimension: "volume",
    multiplierToBase: 3785.41,
    isBase: false,
  },
  oz_fl: {
    id: "oz_fl",
    label: "Onzas Fluidas",
    short: "fl oz",
    dimension: "volume",
    multiplierToBase: 29.5735,
    isBase: false,
  },

  // ─── CONTEO (Base: Unidades) ───────────────────────
  u: {
    id: "u",
    label: "Unidad",
    short: "u",
    dimension: "count",
    multiplierToBase: 1,
    isBase: true,
  },
  docena: {
    id: "docena",
    label: "Docena",
    short: "doc",
    dimension: "count",
    multiplierToBase: 12,
    isBase: false,
  },
  cubeta30: {
    id: "cubeta30",
    label: "Cubeta (30u)",
    short: "cub-30",
    dimension: "count",
    multiplierToBase: 30,
    isBase: false,
  },
};

/**
 * Obtiene todas las unidades base disponibles para crear una materia prima.
 */
export function getBaseUnits(): UnitDefinition[] {
  return Object.values(UNITS).filter((u) => u.isBase);
}

/**
 * Obtiene todas las unidades compatibles (misma dimensión) dada una unidad base.
 * @param baseUnitId El ID de la unidad base (ej. "g")
 */
export function getCompatibleUnits(baseUnitId: string): UnitDefinition[] {
  const baseDef = UNITS[baseUnitId];
  if (!baseDef) return [];
  return Object.values(UNITS).filter((u) => u.dimension === baseDef.dimension);
}

/**
 * Convierte una cantidad de la unidad origen a la unidad base de su dimensión.
 * @param quantity Cantidad ingresada
 * @param unitId Unidad de la cantidad ingresada (ej. "kg")
 * @returns La cantidad equivalente en la unidad base (ej. "g")
 */
export function convertToBase(quantity: number, unitId: string): number {
  const def = UNITS[unitId];
  if (!def) return quantity;
  return Number((quantity * def.multiplierToBase).toFixed(4));
}

/**
 * Convierte un costo total a costo unitario de la unidad base.
 * Ej: Si compró 5 Kg a $50,000 total, el costo unitario por Kg es $10,000,
 * pero el costo unitario BASE (por gramo) es $50,000 / 5000g = $10.
 * @param totalCost Costo total de la compra
 * @param quantity Cantidad ingresada en la unidad origen
 * @param unitId Unidad origen (ej. "kg")
 */
export function calculateBaseUnitCost(totalCost: number, quantity: number, unitId: string): number {
  if (quantity <= 0) return 0;
  const baseQty = convertToBase(quantity, unitId);
  return Number((totalCost / baseQty).toFixed(4));
}
