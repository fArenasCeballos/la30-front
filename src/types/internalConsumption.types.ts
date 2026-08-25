/**
 * Types for the Consumo Interno (Internal Consumption) module.
 *
 * This module tracks employee and partner food orders with a 50% discount
 * on non-beverage items. These orders are internal, independent of DIAN/Siigo
 * invoicing, and can be paid immediately or left as pending balances.
 */

/** Discriminates between an employee (from profiles) and a partner */
export type InternalConsumerType = "employee" | "partner";

/** Payment lifecycle of an internal consumption */
export type InternalPaymentStatus = "paid" | "pending" | "partial";

/**
 * A "socio" (partner) of the restaurant who can access internal consumption.
 * These are NOT system users; they are managed from a dedicated sub-module.
 */
export interface InternalPartner {
  id: string;
  name: string;
  document_id: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Header record for an internal consumption order.
 */
export interface InternalConsumption {
  id: string;
  store_id: string;
  consumer_type: InternalConsumerType;
  employee_id: string | null;
  partner_id: string | null;
  consumer_name: string;
  total_original: number;
  discount_total: number;
  total: number;
  payment_status: InternalPaymentStatus;
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  paid_at: string | null;
}

/** Consumption with its joined line items */
export interface InternalConsumptionWithItems extends InternalConsumption {
  internal_consumption_items: InternalConsumptionItem[];
}

/**
 * A single product line in an internal consumption order.
 */
export interface InternalConsumptionItem {
  id: string;
  consumption_id: string;
  product_id: string | null;
  product_name: string;
  category_name: string | null;
  is_beverage: boolean;
  quantity: number;
  original_price: number;
  discount_percent: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
}

/**
 * A payment or partial payment (abono) against an internal consumption.
 */
export interface InternalConsumptionPayment {
  id: string;
  consumption_id: string | null;
  consumer_type: InternalConsumerType;
  employee_id: string | null;
  partner_id: string | null;
  amount: number;
  payment_method: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

/**
 * Aggregated monthly account statement for a single consumer
 * (employee or partner). Computed client-side from raw records.
 */
export interface MonthlyAccountStatement {
  consumerId: string;
  consumerName: string;
  consumerType: InternalConsumerType;
  /** ISO month string, e.g. "2026-08" */
  month: string;
  totalConsumed: number;
  totalPaid: number;
  balance: number;
  consumptions: InternalConsumptionWithItems[];
  payments: InternalConsumptionPayment[];
}
