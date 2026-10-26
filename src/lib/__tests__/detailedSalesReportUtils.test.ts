import { describe, it, expect } from "vitest";
import {
  filterDetailedItems,
  aggregateByProduct,
  aggregateByWaiter,
  aggregateByCategory,
  type DetailedSaleItem,
} from "../detailedSalesReportUtils";

const mockItems: DetailedSaleItem[] = [
  {
    id: "item-1",
    orderId: "ord-1",
    orderLocator: "LOC-01",
    orderDate: "2026-10-26T14:00:00Z",
    orderStatus: "entregado",
    isDelivery: false,
    waiterId: "waiter-1",
    waiterName: "Carlos Pérez",
    productId: "prod-1",
    productName: "Hamburguesa Doble",
    categoryId: "cat-1",
    categoryName: "Hamburguesas",
    quantity: 2,
    unitPrice: 20000,
    extrasTotal: 2000,
    totalPrice: 44000,
  },
  {
    id: "item-2",
    orderId: "ord-1",
    orderLocator: "LOC-01",
    orderDate: "2026-10-26T14:00:00Z",
    orderStatus: "entregado",
    isDelivery: false,
    waiterId: "waiter-1",
    waiterName: "Carlos Pérez",
    productId: "prod-2",
    productName: "Gaseosa 400ml",
    categoryId: "cat-2",
    categoryName: "Bebidas",
    quantity: 2,
    unitPrice: 5000,
    extrasTotal: 0,
    totalPrice: 10000,
  },
  {
    id: "item-3",
    orderId: "ord-2",
    orderLocator: "LOC-02",
    orderDate: "2026-10-26T15:00:00Z",
    orderStatus: "entregado",
    isDelivery: false,
    waiterId: "waiter-2",
    waiterName: "María Gómez",
    productId: "prod-1",
    productName: "Hamburguesa Doble",
    categoryId: "cat-1",
    categoryName: "Hamburguesas",
    quantity: 3,
    unitPrice: 20000,
    extrasTotal: 0,
    totalPrice: 60000,
  },
  {
    id: "item-4",
    orderId: "ord-3",
    orderLocator: "LOC-03",
    orderDate: "2026-10-26T16:00:00Z",
    orderStatus: "entregado",
    isDelivery: true,
    waiterId: "waiter-2",
    waiterName: "María Gómez",
    productId: "prod-3",
    productName: "Perro Especial",
    categoryId: "cat-3",
    categoryName: "Perros",
    quantity: 1,
    unitPrice: 15000,
    extrasTotal: 0,
    totalPrice: 15000,
  },
];

describe("detailedSalesReportUtils", () => {
  describe("filterDetailedItems", () => {
    it("debe retornar todos los elementos si los filtros están en 'all'", () => {
      const filtered = filterDetailedItems(mockItems, {
        waiterId: "all",
        categoryId: "all",
        productId: "all",
        searchTerm: "",
      });
      expect(filtered.length).toBe(4);
    });

    it("debe filtrar correctamente por mesero", () => {
      const filtered = filterDetailedItems(mockItems, {
        waiterId: "waiter-1",
      });
      expect(filtered.length).toBe(2);
      expect(filtered.every((i) => i.waiterId === "waiter-1")).toBe(true);
    });

    it("debe filtrar correctamente por categoría", () => {
      const filtered = filterDetailedItems(mockItems, {
        categoryId: "cat-1",
      });
      expect(filtered.length).toBe(2);
      expect(filtered.every((i) => i.categoryName === "Hamburguesas")).toBe(true);
    });

    it("debe filtrar correctamente por producto", () => {
      const filtered = filterDetailedItems(mockItems, {
        productId: "prod-1",
      });
      expect(filtered.length).toBe(2);
      expect(filtered.every((i) => i.productId === "prod-1")).toBe(true);
    });

    it("debe filtrar por término de búsqueda en producto, mesero o categoría", () => {
      const filteredProd = filterDetailedItems(mockItems, {
        searchTerm: "doble",
      });
      expect(filteredProd.length).toBe(2);

      const filteredWaiter = filterDetailedItems(mockItems, {
        searchTerm: "María",
      });
      expect(filteredWaiter.length).toBe(2);
    });
  });

  describe("aggregateByProduct", () => {
    it("debe agrupar productos y determinar el mesero que más vendió cada producto", () => {
      const summary = aggregateByProduct(mockItems, "quantity");

      // prod-1 ("Hamburguesa Doble") vendió 5 unidades en total (2 Carlos + 3 María)
      const burger = summary.find((p) => p.productId === "prod-1");
      expect(burger).toBeDefined();
      expect(burger?.totalQty).toBe(5);
      expect(burger?.totalRevenue).toBe(104000);
      expect(burger?.topWaiter?.waiterName).toBe("María Gómez");
      expect(burger?.topWaiter?.quantity).toBe(3);
    });

    it("debe ordenar productos por cantidad de mayor a menor", () => {
      const summary = aggregateByProduct(mockItems, "quantity");
      expect(summary[0].productId).toBe("prod-1"); // 5 unidades
    });
  });

  describe("aggregateByWaiter", () => {
    it("debe agrupar por mesero y determinar el producto que más vendió cada mesero", () => {
      const summary = aggregateByWaiter(mockItems, "revenue");

      // María Gómez vendió prod-1 ($60k) y prod-3 ($15k) = $75k
      const maria = summary.find((w) => w.waiterId === "waiter-2");
      expect(maria).toBeDefined();
      expect(maria?.totalRevenue).toBe(75000);
      expect(maria?.totalQty).toBe(4);
      expect(maria?.orderCount).toBe(2);
      expect(maria?.topProduct?.productName).toBe("Hamburguesa Doble");
      expect(maria?.topProduct?.quantity).toBe(3);
    });
  });

  describe("aggregateByCategory", () => {
    it("debe agrupar por categoría y mostrar productos y meseros líderes", () => {
      const summary = aggregateByCategory(mockItems, "quantity");

      const burgersCat = summary.find((c) => c.categoryId === "cat-1");
      expect(burgersCat).toBeDefined();
      expect(burgersCat?.totalQty).toBe(5);
      expect(burgersCat?.topProduct?.productName).toBe("Hamburguesa Doble");
      expect(burgersCat?.topWaiter?.waiterName).toBe("María Gómez");
    });
  });
});
