import { describe, it, expect } from "vitest";
import {
  extractFirstName,
  buildCustomerReceiptHTML,
  buildKitchenReceiptHTML,
} from "../receiptUtils";
import type { Order } from "@/types";

describe("receiptUtils", () => {
  describe("extractFirstName", () => {
    it("should return only the first name when given full or compound names", () => {
      expect(extractFirstName("Carlos")).toBe("Carlos");
      expect(extractFirstName("Carlos Alberto")).toBe("Carlos");
      expect(extractFirstName("JUAN MANUEL")).toBe("JUAN");
      expect(extractFirstName("  Andres  Felipe  ")).toBe("Andres");
      expect(extractFirstName("Maria-Jose Gomez")).toBe("Maria-Jose");
    });

    it("should return empty string for falsy/empty values", () => {
      expect(extractFirstName("")).toBe("");
      expect(extractFirstName(null)).toBe("");
      expect(extractFirstName(undefined)).toBe("");
      expect(extractFirstName("   ")).toBe("");
    });
  });

  describe("buildCustomerReceiptHTML with delivery driver", () => {
    const baseDeliveryOrder: Order = {
      id: "order-123",
      locator: "D-A01",
      ticket_number: "0001",
      status: "pendiente",
      total: 35000,
      total_amount: 35000,
      is_delivery: true,
      delivery_name: "Pepito Perez",
      delivery_address: "Calle 10 # 20-30",
      delivery_phone: "3001234567",
      delivery_fee: 5000,
      driver_id: "driver-1",
      created_at: "2026-08-26T20:00:00.000Z",
      updated_at: "2026-08-26T20:00:00.000Z",
      user_id: "user-1",
      store_id: "store-1",
      notes: null,
      order_items: [],
      profiles: null,
      delivery_drivers: {
        id: "driver-1",
        first_name: "Santiago Alejandro",
        last_name: "Rodriguez",
      },
      is_dispatched: false,
      siigo_invoice_id: null,
      siigo_invoice_number: null
    };

    it("should render only the first name of the delivery driver in receipt", () => {
      const html = buildCustomerReceiptHTML({
        order: baseDeliveryOrder,
        cajeroName: "Cajero Test",
      });

      expect(html).toContain("Domiciliario:");
      expect(html).toContain("SANTIAGO");
      expect(html).not.toContain("SANTIAGO ALEJANDRO");
    });

    it("should prioritize driverName passed explicitly in ReceiptData", () => {
      const html = buildCustomerReceiptHTML({
        order: baseDeliveryOrder,
        cajeroName: "Cajero Test",
        driverName: "Mateo Fernando",
      });

      expect(html).toContain("Domiciliario:");
      expect(html).toContain("MATEO");
      expect(html).not.toContain("SANTIAGO");
    });

    it("should not render Domiciliario if not a delivery or no driver", () => {
      const mesaOrder: Order = {
        ...baseDeliveryOrder,
        is_delivery: false,
        delivery_drivers: null,
      };

      const html = buildCustomerReceiptHTML({
        order: mesaOrder,
        cajeroName: "Cajero Test",
      });

      expect(html).not.toContain("Domiciliario:");
    });
  });

  describe("buildKitchenReceiptHTML with delivery order", () => {
    const baseDeliveryOrder: Order = {
      id: "order-123",
      locator: "D-A01",
      ticket_number: "0001",
      status: "pendiente",
      total: 35000,
      total_amount: 35000,
      is_delivery: true,
      delivery_name: "Pepito Perez",
      delivery_address: "Calle 10 # 20-30",
      delivery_phone: "3001234567",
      delivery_fee: 5000,
      driver_id: "driver-1",
      created_at: "2026-08-26T20:00:00.000Z",
      updated_at: "2026-08-26T20:00:00.000Z",
      user_id: "user-1",
      store_id: "store-1",
      notes: null,
      order_items: [],
      profiles: null,
      delivery_drivers: {
        id: "driver-1",
        first_name: "Santiago Alejandro",
        last_name: "Rodriguez",
      },
      is_dispatched: false,
      siigo_invoice_id: null,
      siigo_invoice_number: null,
    };

    it("should organize multiple categories in a single kitchen receipt", () => {
      const orderWithMultipleCategories: Order = {
        ...baseDeliveryOrder,
        order_items: [
          {
            id: "item-1",
            order_id: "order-123",
            product_id: "p-1",
            quantity: 2,
            unit_price: 10000,
            subtotal: 20000,
            notes: null,
            customizations: null,
            extras: null,
            is_completed: false,
            created_at: "2026-08-26T20:00:00.000Z",
            choices: {},
            products: {
              id: "p-1",
              name: "Hamburguesa Doble",
              price: 10000,
              available: true,
              category_id: "cat-1",
              description: null,
              image_url: null,
              sort_order: 1,
              store_ids: ["store-1"],
              created_at: "2026-08-26T20:00:00.000Z",
              siigo_code: null,
              categories: {
                id: "cat-1",
                name: "Hamburguesas",
                label: "Hamburguesas",
                icon: "burger",
                description: null,
                is_active: true,
                store_ids: ["store-1"],
                sort_order: 1,
                created_at: "2026-08-26T20:00:00.000Z",
              },
            },
          },
          {
            id: "item-2",
            order_id: "order-123",
            product_id: "p-2",
            quantity: 1,
            unit_price: 5000,
            subtotal: 5000,
            notes: null,
            customizations: null,
            extras: null,
            is_completed: false,
            created_at: "2026-08-26T20:00:00.000Z",
            choices: {},
            products: {
              id: "p-2",
              name: "Papas Fritas",
              price: 5000,
              available: true,
              category_id: "cat-2",
              description: null,
              image_url: null,
              sort_order: 2,
              store_ids: ["store-1"],
              created_at: "2026-08-26T20:00:00.000Z",
              siigo_code: null,
              categories: {
                id: "cat-2",
                name: "Acompañamientos",
                label: "Acompañamientos",
                icon: "fries",
                description: null,
                is_active: true,
                store_ids: ["store-1"],
                sort_order: 2,
                created_at: "2026-08-26T20:00:00.000Z",
              },
            },
          },
        ],
      };

      const html = buildKitchenReceiptHTML({
        order: orderWithMultipleCategories,
        cajeroName: "Cajero Test",
      });

      expect(html).toContain("Hamburguesas");
      expect(html).toContain("Acompañamientos");
      expect(html).toContain("HAMBURGUESA DOBLE");
      expect(html).toContain("PAPAS FRITAS");
    });
  });
});
