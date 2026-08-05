export function formatPrice(price: number | null | undefined): string {
  const safe = typeof price === "number" && isFinite(price) ? price : 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(safe);
}
