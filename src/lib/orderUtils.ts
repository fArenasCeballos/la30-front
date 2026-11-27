import type { Order } from "@/types";

/**
 * Checks whether an order originated from the mobile app.
 */
export function isAppOrder(order: Order | null | undefined): boolean {
  if (!order) return false;
  const source = (order.order_source || "").trim().toLowerCase();
  if (source === "app" || source === "app_movil" || source === "mobile")
    return true;
  if (order.app_customer_id) return true;
  if (order.delivery_distance_km != null || order.delivery_lat != null)
    return true;
  if (order.is_prepaid === true) return true;
  return false;
}

/**
 * Checks whether an order was prepaid online (e.g. via Wompi in the mobile app).
 */
export function isPrepaidOrder(order: Order | null | undefined): boolean {
  if (!order) return false;
  if (order.is_prepaid === true) return true;
  if (isAppOrder(order)) return true;
  if (
    order.payments?.some((p) =>
      ["wompi", "online", "tarjeta_wompi", "nequi_wompi"].includes(
        p.method?.toLowerCase(),
      ),
    )
  ) {
    return true;
  }
  return false;
}
