import { describe, it, expect } from "vitest";
import { formatPrice, formatTaxNumber, formatTaxPrice } from "../formatPrice";

describe("formatPrice", () => {
  it("formats integer COP currency amounts correctly", () => {
    expect(formatPrice(25000)).toMatch(/\$?\s?25\.000/);
    expect(formatPrice(0)).toMatch(/\$?\s?0/);
    expect(formatPrice(1500)).toMatch(/\$?\s?1\.500/);
  });

  it("handles falsy and zero values gracefully", () => {
    expect(formatPrice(0)).toBeDefined();
  });
});

describe("formatTaxNumber and formatTaxPrice", () => {
  it("formats tax base and impoconsumo with 2 decimals in es-CO", () => {
    const base = 19000 / 1.08;
    const tax = 19000 - base;

    expect(formatTaxNumber(base)).toBe("17.592,59");
    expect(formatTaxNumber(tax)).toBe("1.407,41");

    expect(formatTaxPrice(base)).toMatch(/\$?\s?17\.592,59/);
    expect(formatTaxPrice(tax)).toMatch(/\$?\s?1\.407,41/);
  });
});
