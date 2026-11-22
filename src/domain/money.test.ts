import { describe, expect, it } from "vitest";
import { formatRupiah, formatShort } from "./money";

describe("formatRupiah", () => {
  it("uses Indonesian grouping with no decimals", () => {
    expect(formatRupiah(80_000)).toBe("Rp80.000");
    expect(formatRupiah(1_250_000)).toBe("Rp1.250.000");
    expect(formatRupiah(0)).toBe("Rp0");
  });
  it("marks refunds with a real minus sign", () => {
    expect(formatRupiah(-50_000)).toBe("−Rp50.000");
  });
  it("refuses fractional rupiah", () => {
    expect(() => formatRupiah(10.5)).toThrow(RangeError);
  });
});

describe("formatShort", () => {
  it("matches the pricelist shorthand", () => {
    expect(formatShort(80_000)).toBe("80K");
    expect(formatShort(125_000)).toBe("125K");
    expect(formatShort(1_250_000)).toBe("1,25 jt");
    expect(formatShort(500)).toBe("500");
  });
});
