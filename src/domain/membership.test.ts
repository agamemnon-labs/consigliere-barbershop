import { describe, expect, it } from "vitest";
import {
  applyBirthday,
  applyVoucher,
  isBirthdayMonth,
  ledgerTotal,
  memberNoFor,
  pinProblem,
  pointsEarned,
  redeemableUnits,
  topupRows,
} from "./membership.ts";

const haircut = { serviceId: "h", name: "Haircut", price: 110_000, discount: 0, category: "haircut" };
const shave = { serviceId: "s", name: "Shave", price: 70_000, discount: 0, category: "refreshment" };

describe("points", () => {
  it("earns one point per full 50K paid", () => {
    expect(pointsEarned(49_999)).toBe(0);
    expect(pointsEarned(180_000)).toBe(3);
    expect(pointsEarned(-1)).toBe(0);
  });

  it("redeems whole vouchers only, never more than the bill", () => {
    expect(redeemableUnits(25, 500_000)).toBe(2);
    expect(redeemableUnits(25, 80_000)).toBe(1);
    expect(redeemableUnits(9, 500_000)).toBe(0);
  });

  it("spreads a voucher over the items front to back", () => {
    const out = applyVoucher([haircut, shave], 150_000);
    expect(out.map((i) => i.discount)).toEqual([110_000, 40_000]);
  });
});

describe("birthday", () => {
  it("is the whole birth month, any year", () => {
    expect(isBirthdayMonth("1995-11-30", "2026-11-01")).toBe(true);
    expect(isBirthdayMonth("1995-12-01", "2026-11-30")).toBe(false);
  });

  it("halves the haircut only", () => {
    const out = applyBirthday([haircut, shave]);
    expect(out.map((i) => i.discount)).toEqual([55_000, 0]);
  });
});

describe("balance", () => {
  it("writes the bonus as its own row", () => {
    expect(topupRows({ pay: 300_000, get: 330_000 })).toEqual([
      { delta: 300_000, reason: "topup" },
      { delta: 30_000, reason: "bonus" },
    ]);
    expect(topupRows({ pay: 100_000, get: 100_000 })).toHaveLength(1);
    expect(() => topupRows({ pay: 100_000, get: 90_000 })).toThrow();
  });

  it("is the sum of its rows", () => {
    expect(ledgerTotal([{ delta: 300_000 }, { delta: 30_000 }, { delta: -110_000 }])).toBe(220_000);
  });
});

describe("PIN and member number", () => {
  it.each([
    ["482913", null],
    ["12345", "PIN harus 6 angka."],
    ["111111", "PIN jangan angka yang sama semua."],
    ["123456", "PIN jangan angka berurutan."],
    ["987654", "PIN jangan angka berurutan."],
  ])("%s", (pin, problem) => {
    expect(pinProblem(pin)).toBe(problem);
  });

  it("pads the member number", () => {
    expect(memberNoFor(12)).toBe("C00012");
  });
});
