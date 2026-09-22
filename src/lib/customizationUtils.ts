export interface CustomOption {
  id: string;
  option_key: string;
  label: string;
  icon: string;
  choices: { id: string; value: string; label: string; icon: string }[];
}

export interface ExtraOption {
  id: string;
  extra_key: string;
  label: string;
  icon: string;
  price_per_unit: number;
  max_qty: number;
}

export interface CustomizationValues {
  selections: Record<string, string[]>;
  extraQtys: Record<string, number>;
  observation: string;
}

/**
 * Calcula el costo total de los adicionales seleccionados.
 */
export function calculateExtraCost(
  extras: ExtraOption[] = [],
  extraQtys: Record<string, number> = {},
): number {
  return extras.reduce((sum, ext) => {
    const qty = Math.max(0, extraQtys[ext?.id] || 0);
    const unitPrice = Number(ext?.price_per_unit) || 0;
    return sum + qty * unitPrice;
  }, 0);
}

/**
 * Reconstruye el objeto de personalización a partir del string de notas de un ítem.
 * Útil para pedidos cargados desde base de datos o drafts sin customizationValues.
 */
export function parseNotesToCustomization(
  notes?: string | null,
  options: CustomOption[] = [],
  extras: ExtraOption[] = [],
): CustomizationValues {
  const result: CustomizationValues = {
    selections: {},
    extraQtys: {},
    observation: "",
  };

  if (!notes || !notes.trim()) {
    return result;
  }

  const parts = notes.split(",").map((p) => p.trim()).filter(Boolean);
  const unparsedNotes: string[] = [];

  for (const part of parts) {
    // 1. Revisar si es una observación explícita (ej: "Obs: salsa aparte")
    if (part.toLowerCase().startsWith("obs:")) {
      const obsText = part.replace(/^obs:\s*/i, "").trim();
      if (obsText) {
        result.observation = result.observation
          ? `${result.observation}, ${obsText}`
          : obsText;
      }
      continue;
    }

    // 2. Revisar si es un adicional con formato "+1 Extra" o "+ 2 Extra"
    const extraMatch = part.match(/^\+\s*(\d+)\s+(.+)$/i);
    if (extraMatch) {
      const qty = parseInt(extraMatch[1], 10);
      const label = extraMatch[2].trim().toLowerCase();

      const matchedExtra = extras.find(
        (e) =>
          e.label.trim().toLowerCase() === label ||
          e.extra_key.trim().toLowerCase() === label ||
          label.includes(e.label.trim().toLowerCase()),
      );

      if (matchedExtra && !isNaN(qty) && qty > 0) {
        result.extraQtys[matchedExtra.id] = Math.min(
          matchedExtra.max_qty || 99,
          qty,
        );
        continue;
      }
    }

    // 3. Revisar si coincide con una opción / elección (ej: "Pan Brioche", "Término 3/4")
    let matchedOption = false;
    for (const opt of options) {
      const choice = opt.choices?.find(
        (c) => c.label.trim().toLowerCase() === part.toLowerCase(),
      );
      if (choice) {
        if (!result.selections[opt.id]) {
          result.selections[opt.id] = [];
        }
        if (!result.selections[opt.id].includes(choice.value)) {
          result.selections[opt.id].push(choice.value);
        }
        matchedOption = true;
        break;
      }
    }

    if (matchedOption) continue;

    // Si no coincide con opciones ni adicionales formalmente, es una observación libre
    unparsedNotes.push(part);
  }

  if (unparsedNotes.length > 0) {
    const unparsedText = unparsedNotes.join(", ");
    result.observation = result.observation
      ? `${result.observation}, ${unparsedText}`
      : unparsedText;
  }

  return result;
}
