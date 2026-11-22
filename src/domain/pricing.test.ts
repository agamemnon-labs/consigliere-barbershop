import { describe, expect, it } from "vitest";
import { priceLabel } from "./pricing";

const base = { price: null, priceFrom: null, variants: [] };

describe("priceLabel", () => {
  it("shows the haircut range across barber levels", () => {
    expect(priceLabel({ ...base, priceType: "by_level" }, [95_000, 80_000, 125_000, 110_000])).toBe(
      "80K–125K",
    );
    expect(priceLabel({ ...base, priceType: "by_level" }, [80_000])).toBe("80K");
  });
  it("marks starting-from and variant prices with +", () => {
    expect(priceLabel({ ...base, priceType: "from", priceFrom: 300_000 }, [])).toBe("300K+");
    expect(
      priceLabel({ ...base, priceType: "variant", variants: [{ price: 600_000 }, { price: 400_000 }] }, []),
    ).toBe("400K+");
  });
  it("shows fixed prices plainly", () => {
    expect(priceLabel({ ...base, priceType: "fixed", price: 70_000 }, [])).toBe("70K");
  });
  it("fails loudly on a fixed service without a price", () => {
    expect(() => priceLabel({ ...base, priceType: "fixed" }, [])).toThrow();
  });
});
