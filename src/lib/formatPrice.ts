export function formatPrice(price: number | null | undefined): string {
  const safe = typeof price === "number" && isFinite(price) ? price : 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(safe);
}

export function formatTaxNumber(value: number | null | undefined): string {
  const safe = typeof value === "number" && isFinite(value) ? value : 0;
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatTaxPrice(value: number | null | undefined): string {
  const safe = typeof value === "number" && isFinite(value) ? value : 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}
