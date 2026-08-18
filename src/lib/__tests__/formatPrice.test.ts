import { describe, it, expect } from "vitest";
import { formatPrice } from "../formatPrice";

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
