/**
 * Returns the appropriate emoji for a category or product.
 * Prioritizes the category's configured icon, falling back to
 * category/product keyword detection matching Kiosko conventions.
 */
export function getCategoryEmoji(product?: {
  categories?: { icon?: string | null; name?: string | null; label?: string | null } | null;
  name?: string | null;
}): string {
  // 1. If category has an icon defined in database, use it directly
  const rawIcon = product?.categories?.icon?.trim();
  if (rawIcon) {
    return rawIcon;
  }

  // 2. Intelligent keyword match on category and product names
  const cat = (
    product?.categories?.name ||
    product?.categories?.label ||
    ""
  ).toLowerCase();
  const prod = (product?.name || "").toLowerCase();
  const text = `${cat} ${prod}`;

  if (
    text.includes("bebida") ||
    text.includes("gaseosa") ||
    text.includes("jugo") ||
    text.includes("agua") ||
    text.includes("soda") ||
    text.includes("cerveza") ||
    text.includes("refresco") ||
    text.includes("limonada") ||
    text.includes("té") ||
    text.includes("te ")
  ) {
    return "🥤";
  }

  if (
    text.includes("perro") ||
    text.includes("hot dog") ||
    text.includes("hotdog") ||
    text.includes("salchicha")
  ) {
    return "🌭";
  }

  if (
    text.includes("papa") ||
    text.includes("francesa") ||
    text.includes("salchipapa") ||
    text.includes("aros") ||
    text.includes("entrada") ||
    text.includes("adicion") ||
    text.includes("adición") ||
    text.includes("acompañamiento")
  ) {
    return "🍟";
  }

  if (
    text.includes("pollo") ||
    text.includes("alitas") ||
    text.includes("nuggets") ||
    text.includes("crispy") ||
    text.includes("tender") ||
    text.includes("wing")
  ) {
    return "🍗";
  }

  if (text.includes("pizza")) {
    return "🍕";
  }

  if (
    text.includes("taco") ||
    text.includes("quesadilla") ||
    text.includes("burrito") ||
    text.includes("nacho") ||
    text.includes("mexican")
  ) {
    return "🌮";
  }

  if (
    text.includes("sandwich") ||
    text.includes("sanduche") ||
    text.includes("sándwich") ||
    text.includes("panini")
  ) {
    return "🥪";
  }

  if (
    text.includes("carne") ||
    text.includes("asado") ||
    text.includes("parrilla") ||
    text.includes("bife") ||
    text.includes("costilla") ||
    text.includes("lomo")
  ) {
    return "🥩";
  }

  if (
    text.includes("postre") ||
    text.includes("helado") ||
    text.includes("malteada") ||
    text.includes("dulce") ||
    text.includes("torta") ||
    text.includes("brownie") ||
    text.includes("shake")
  ) {
    return "🍦";
  }

  if (
    text.includes("combo") ||
    text.includes("promo") ||
    text.includes("especial")
  ) {
    return "🍱";
  }

  if (
    text.includes("cafe") ||
    text.includes("café") ||
    text.includes("capuchino") ||
    text.includes("tinto")
  ) {
    return "☕";
  }

  if (text.includes("hamburguesa") || text.includes("burger")) {
    return "🍔";
  }

  return "🍽️";
}
