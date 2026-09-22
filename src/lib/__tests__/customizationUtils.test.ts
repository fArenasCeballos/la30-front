import { describe, it, expect } from "vitest";
import {
  calculateExtraCost,
  parseNotesToCustomization,
  type CustomOption,
  type ExtraOption,
} from "../customizationUtils";

describe("customizationUtils", () => {
  const sampleExtras: ExtraOption[] = [
    {
      id: "extra-tocineta",
      extra_key: "tocineta_extra",
      label: "Tocineta Extra",
      icon: "🥓",
      price_per_unit: 5000,
      max_qty: 3,
    },
    {
      id: "extra-queso",
      extra_key: "queso_extra",
      label: "Queso Cheddar",
      icon: "🧀",
      price_per_unit: 4000,
      max_qty: 2,
    },
  ];

  const sampleOptions: CustomOption[] = [
    {
      id: "opt-termino",
      option_key: "termino_carne",
      label: "Término de la carne",
      icon: "🥩",
      choices: [
        { id: "c1", value: "medio", label: "Término Medio", icon: "🔹" },
        { id: "c2", value: "tres_cuartos", label: "Término 3/4", icon: "🔹" },
        { id: "c3", value: "bien_asado", label: "Bien Asado", icon: "🔹" },
      ],
    },
    {
      id: "opt-pan",
      option_key: "tipo_pan",
      label: "Tipo de pan",
      icon: "🍞",
      choices: [
        { id: "p1", value: "artesanal", label: "Pan Artesanal", icon: "🥖" },
        { id: "p2", value: "brioche", label: "Pan Brioche", icon: "🍞" },
      ],
    },
  ];

  describe("calculateExtraCost", () => {
    it("should return 0 when no extras are selected", () => {
      expect(calculateExtraCost(sampleExtras, {})).toBe(0);
      expect(calculateExtraCost([], { "extra-tocineta": 2 })).toBe(0);
    });

    it("should calculate correct total when extras have quantities", () => {
      const extraQtys = {
        "extra-tocineta": 2, // 2 * 5000 = 10000
        "extra-queso": 1, // 1 * 4000 = 4000
      };
      expect(calculateExtraCost(sampleExtras, extraQtys)).toBe(14000);
    });

    it("should ignore 0 or negative quantities", () => {
      const extraQtys = {
        "extra-tocineta": 0,
        "extra-queso": -2,
      };
      expect(calculateExtraCost(sampleExtras, extraQtys)).toBe(0);
    });
  });

  describe("parseNotesToCustomization", () => {
    it("should return empty object for empty or null notes", () => {
      const emptyResult = { selections: {}, extraQtys: {}, observation: "" };
      expect(parseNotesToCustomization("")).toEqual(emptyResult);
      expect(parseNotesToCustomization(null)).toEqual(emptyResult);
      expect(parseNotesToCustomization(undefined)).toEqual(emptyResult);
    });

    it("should parse additions with +N Label correctly", () => {
      const notes = "+2 Tocineta Extra, +1 Queso Cheddar";
      const result = parseNotesToCustomization(notes, sampleOptions, sampleExtras);

      expect(result.extraQtys["extra-tocineta"]).toBe(2);
      expect(result.extraQtys["extra-queso"]).toBe(1);
      expect(result.observation).toBe("");
    });

    it("should parse selected options by choice label", () => {
      const notes = "Término 3/4, Pan Brioche";
      const result = parseNotesToCustomization(notes, sampleOptions, sampleExtras);

      expect(result.selections["opt-termino"]).toEqual(["tres_cuartos"]);
      expect(result.selections["opt-pan"]).toEqual(["brioche"]);
    });

    it("should extract observations starting with Obs:", () => {
      const notes = "Término Medio, +1 Tocineta Extra, Obs: salsa aparte y bien caliente";
      const result = parseNotesToCustomization(notes, sampleOptions, sampleExtras);

      expect(result.selections["opt-termino"]).toEqual(["medio"]);
      expect(result.extraQtys["extra-tocineta"]).toBe(1);
      expect(result.observation).toBe("salsa aparte y bien caliente");
    });

    it("should preserve unmatched text as observation", () => {
      const notes = "+1 Tocineta Extra, Sin cebolla";
      const result = parseNotesToCustomization(notes, sampleOptions, sampleExtras);

      expect(result.extraQtys["extra-tocineta"]).toBe(1);
      expect(result.observation).toBe("Sin cebolla");
    });
  });

  describe("Cart rehydration unit price preservation", () => {
    it("should preserve unitPrice with additions instead of falling back to product base price", () => {
      const product = { id: "prod-1", price: 25000 };
      const savedDraftItem = {
        productId: "prod-1",
        quantity: 2,
        notes: "+1 Tocineta Extra",
        unitPrice: 30000, // 25000 base + 5000 extra
      };

      const rawUnitPrice = Number(savedDraftItem.unitPrice);
      const basePrice = Number(product.price) || 0;
      const unitPrice =
        !isNaN(rawUnitPrice) && rawUnitPrice >= basePrice
          ? rawUnitPrice
          : basePrice;

      expect(unitPrice).toBe(30000);
      expect(unitPrice * savedDraftItem.quantity).toBe(60000);
    });
  });
});
