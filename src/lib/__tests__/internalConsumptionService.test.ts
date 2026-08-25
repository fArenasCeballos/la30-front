import { describe, it, expect, vi } from "vitest";

// Mock the supabase client to avoid window.localStorage reference in Node test env
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import {
  isBeverageProduct,
  calculateInternalPrice,
  INTERNAL_DISCOUNT_PERCENT,
  buildMonthlyStatement,
} from "../internalConsumptionService";
import type {
  InternalConsumptionWithItems,
  InternalConsumptionPayment,
} from "@/types";

// ─── isBeverageProduct ───────────────────────────────────────────────────────

describe("isBeverageProduct", () => {
  it("returns true for known beverage category names", () => {
    expect(isBeverageProduct("Bebidas", "Hamburguesa Doble")).toBe(true);
    expect(isBeverageProduct("GASEOSAS", "Coca-Cola 400ml")).toBe(true);
    expect(isBeverageProduct("Jugos Naturales", "Jugo de Naranja")).toBe(true);
    expect(isBeverageProduct("Cervezas", "Corona")).toBe(true);
    expect(isBeverageProduct("Licores", "Aguardiente")).toBe(true);
  });

  it("returns false for non-beverage category names", () => {
    expect(isBeverageProduct("Hamburguesas", "Doble Queso")).toBe(false);
    expect(isBeverageProduct("Perros", "Perro Tradicional")).toBe(false);
    expect(isBeverageProduct("Combos", "Combo Familiar")).toBe(false);
    expect(isBeverageProduct("Extras", "Papas Fritas")).toBe(false);
  });

  it("falls back to product name when category is null or empty", () => {
    expect(isBeverageProduct(null, "Coca-Cola 400ml")).toBe(true);
    expect(isBeverageProduct("", "Jugo de mora")).toBe(true);
    expect(isBeverageProduct(null, "Hamburguesa")).toBe(false);
    expect(isBeverageProduct(undefined, "Gaseosa Sprite")).toBe(true);
  });

  it("handles case-insensitive matching", () => {
    expect(isBeverageProduct("BEBIDAS", "COCA-COLA")).toBe(true);
    expect(isBeverageProduct("bebidas", "coca-cola")).toBe(true);
    expect(isBeverageProduct("Bebidas", "Coca-Cola")).toBe(true);
  });

  it("returns false for products with no beverage signals", () => {
    expect(isBeverageProduct("Hamburguesas", "Super Doble")).toBe(false);
  });
});

// ─── calculateInternalPrice ──────────────────────────────────────────────────

describe("calculateInternalPrice", () => {
  it("applies 50% discount to non-beverage products", () => {
    expect(calculateInternalPrice(20000, false)).toBe(10000);
    expect(calculateInternalPrice(25000, false)).toBe(12500);
    expect(calculateInternalPrice(15000, false)).toBe(7500);
  });

  it("applies no discount to beverage products", () => {
    expect(calculateInternalPrice(5000, true)).toBe(5000);
    expect(calculateInternalPrice(8000, true)).toBe(8000);
  });

  it("handles zero price", () => {
    expect(calculateInternalPrice(0, false)).toBe(0);
    expect(calculateInternalPrice(0, true)).toBe(0);
  });

  it("handles odd prices (rounds correctly)", () => {
    // 13000 * 0.5 = 6500 (exact)
    expect(calculateInternalPrice(13000, false)).toBe(6500);
    // 13001 * 0.5 = 6500.5 → rounds to 6501
    expect(calculateInternalPrice(13001, false)).toBe(6501);
  });

  it("exports the correct discount constant", () => {
    expect(INTERNAL_DISCOUNT_PERCENT).toBe(50);
  });
});

// ─── buildMonthlyStatement ───────────────────────────────────────────────────

describe("buildMonthlyStatement", () => {
  const makeConsumption = (
    total: number,
    status: "paid" | "pending" | "partial",
  ): InternalConsumptionWithItems => ({
    id: crypto.randomUUID(),
    store_id: "store-1",
    consumer_type: "employee",
    employee_id: "emp-1",
    partner_id: null,
    consumer_name: "Juan Pérez",
    total_original: total * 2,
    discount_total: total,
    total,
    payment_status: status,
    payment_method: status === "paid" ? "efectivo" : null,
    notes: null,
    created_by: null,
    created_at: "2026-08-15T12:00:00Z",
    paid_at: status === "paid" ? "2026-08-15T12:00:00Z" : null,
    internal_consumption_items: [],
  });

  const makePayment = (amount: number): InternalConsumptionPayment => ({
    id: crypto.randomUUID(),
    consumption_id: null,
    consumer_type: "employee",
    employee_id: "emp-1",
    partner_id: null,
    amount,
    payment_method: "efectivo",
    notes: null,
    recorded_by: null,
    created_at: "2026-08-20T12:00:00Z",
  });

  it("calculates correct totals when all consumptions are paid", () => {
    const consumptions = [
      makeConsumption(10000, "paid"),
      makeConsumption(15000, "paid"),
    ];
    const statement = buildMonthlyStatement(
      "emp-1",
      "Juan Pérez",
      "employee",
      "2026-08",
      consumptions,
      [],
    );

    expect(statement.totalConsumed).toBe(25000);
    expect(statement.totalPaid).toBe(25000);
    expect(statement.balance).toBe(0);
  });

  it("calculates correct balance when consumptions are pending", () => {
    const consumptions = [
      makeConsumption(10000, "pending"),
      makeConsumption(15000, "pending"),
    ];
    const statement = buildMonthlyStatement(
      "emp-1",
      "Juan Pérez",
      "employee",
      "2026-08",
      consumptions,
      [],
    );

    expect(statement.totalConsumed).toBe(25000);
    expect(statement.totalPaid).toBe(0);
    expect(statement.balance).toBe(25000);
  });

  it("accounts for partial payments via payment records", () => {
    const consumptions = [makeConsumption(20000, "pending")];
    const payments = [makePayment(5000)];

    const statement = buildMonthlyStatement(
      "emp-1",
      "Juan Pérez",
      "employee",
      "2026-08",
      consumptions,
      payments,
    );

    expect(statement.totalConsumed).toBe(20000);
    expect(statement.totalPaid).toBe(5000);
    expect(statement.balance).toBe(15000);
  });

  it("never returns a negative balance", () => {
    const consumptions = [makeConsumption(10000, "paid")];
    const payments = [makePayment(5000)]; // Over-pay scenario

    const statement = buildMonthlyStatement(
      "emp-1",
      "Juan Pérez",
      "employee",
      "2026-08",
      consumptions,
      payments,
    );

    expect(statement.balance).toBe(0);
  });

  it("preserves consumer identity fields", () => {
    const statement = buildMonthlyStatement(
      "partner-1",
      "Socio Externo",
      "partner",
      "2026-08",
      [],
      [],
    );

    expect(statement.consumerId).toBe("partner-1");
    expect(statement.consumerName).toBe("Socio Externo");
    expect(statement.consumerType).toBe("partner");
    expect(statement.month).toBe("2026-08");
  });
});
