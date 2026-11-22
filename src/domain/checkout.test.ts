import { describe, expect, it } from "vitest";
import { bill, CheckoutError, creditAvailable } from "./checkout.ts";

const haircut = { serviceId: "h", name: "Haircut", price: 95_000, discount: 0 };
const coloring = { serviceId: "c", name: "Coloring Fashion", price: 350_000, discount: 0 };

describe("bill", () => {
  it("totals items and leaves everything for the EDC", () => {
    expect(bill([haircut, coloring], "edc_qris")).toEqual({
      subtotal: 445_000,
      discounts: 0,
      total: 445_000,
      credit: 0,
      balance: 0,
      due: 445_000,
      method: "edc_qris",
    });
  });

  it("uses credit first and records a mixed payment", () => {
    expect(bill([haircut], "edc_card", { credit: 50_000 })).toMatchObject({
      credit: 50_000,
      due: 45_000,
      method: "mixed",
    });
  });

  it("never uses more credit than the bill", () => {
    expect(bill([haircut], "edc_card", { credit: 500_000 })).toMatchObject({
      credit: 95_000,
      due: 0,
      method: "credit",
    });
  });

  it("takes balance after credit, and only what is left", () => {
    expect(bill([haircut], "edc_qris", { credit: 20_000, balance: 500_000 })).toMatchObject({
      credit: 20_000,
      balance: 75_000,
      due: 0,
      method: "mixed",
    });
    expect(bill([haircut], "edc_qris", { balance: 95_000 }).method).toBe("balance");
  });

  it("refuses empty bills, zero prices and a slipped extra zero", () => {
    expect(() => bill([], "edc_card")).toThrow(CheckoutError);
    expect(() => bill([{ ...coloring, price: 0 }], "edc_card")).toThrow(CheckoutError);
    expect(() => bill([{ ...coloring, price: 35_000_000 }], "edc_card")).toThrow(/terlalu besar/);
    expect(() => bill([{ ...haircut, discount: 100_000 }], "edc_card")).toThrow(CheckoutError);
  });
});

describe("creditAvailable", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const day = (d: string) => new Date(`2026-${d}T00:00:00Z`);

  it("adds unexpired grants and subtracts spending", () => {
    const rows = [
      { delta: 80_000, expiresAt: day("12-20"), createdAt: day("11-20") },
      { delta: -30_000, expiresAt: null, createdAt: day("11-25") },
    ];
    expect(creditAvailable(rows, now)).toBe(50_000);
  });

  it("drops what's left of an expired grant", () => {
    const rows = [{ delta: 80_000, expiresAt: day("11-30"), createdAt: day("10-31") }];
    expect(creditAvailable(rows, now)).toBe(0);
  });

  it("spends the credit that expires first", () => {
    const rows = [
      { delta: 100_000, expiresAt: day("11-30"), createdAt: day("10-31") },
      { delta: 100_000, expiresAt: day("12-25"), createdAt: day("11-25") },
      { delta: -100_000, expiresAt: null, createdAt: day("11-26") },
    ];
    // The spend used the grant expiring on 30 Nov, so the newer grant is whole.
    expect(creditAvailable(rows, now)).toBe(100_000);
  });
});
