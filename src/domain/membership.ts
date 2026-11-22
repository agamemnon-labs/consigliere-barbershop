/**
 * Membership rules: points, the birthday discount, prepaid balance and PINs.
 * Points and balance are ledgers; these functions only read rows or say what
 * rows to write.
 */

export type PointsRule = { earnPer: number; redeemPoints: number; redeemValue: number };
export type BirthdayRule = { percent: number; categories: string[]; stacksWithPoints: boolean };

export const DEFAULT_POINTS: PointsRule = { earnPer: 50_000, redeemPoints: 10, redeemValue: 50_000 };
export const DEFAULT_BIRTHDAY: BirthdayRule = {
  percent: 50,
  categories: ["haircut"],
  stacksWithPoints: false,
};

export class MemberError extends Error {
  override name = "MemberError";
}

/** Points for a payment: one per full 50K actually paid after discounts. */
export function pointsEarned(paid: number, rule: PointsRule = DEFAULT_POINTS): number {
  return paid > 0 ? Math.floor(paid / rule.earnPer) : 0;
}

/** How many 10-point vouchers fit in a points total and a bill. */
export function redeemableUnits(
  points: number,
  billTotal: number,
  rule: PointsRule = DEFAULT_POINTS,
): number {
  return Math.max(
    0,
    Math.min(Math.floor(points / rule.redeemPoints), Math.floor(billTotal / rule.redeemValue)),
  );
}

/** Birthday month, by the member's date of birth (YYYY-MM-DD) and the shop's date. */
export function isBirthdayMonth(dob: string, shopDate: string): boolean {
  return dob.slice(5, 7) === shopDate.slice(5, 7);
}

export type DiscountableItem = {
  serviceId: string;
  name: string;
  price: number;
  discount: number;
  category: string;
};

/** The birthday discount, applied per item to the covered categories (haircut by default). */
export function applyBirthday<T extends DiscountableItem>(
  items: T[],
  rule: BirthdayRule = DEFAULT_BIRTHDAY,
): T[] {
  return items.map((i) =>
    rule.categories.includes(i.category) ? { ...i, discount: Math.floor((i.price * rule.percent) / 100) } : i,
  );
}

/**
 * Spreads a points voucher over the bill as discounts, front to back, so the
 * receipt still adds up line by line.
 */
export function applyVoucher<T extends DiscountableItem>(items: T[], amount: number): T[] {
  let left = amount;
  return items.map((i) => {
    const room = i.price - i.discount;
    const take = Math.min(room, left);
    left -= take;
    return take > 0 ? { ...i, discount: i.discount + take } : i;
  });
}

/** A top-up writes two balance rows: the money paid, and the bonus on its own line for reports. */
export function topupRows(pkg: { pay: number; get: number }): { delta: number; reason: "topup" | "bonus" }[] {
  if (pkg.get < pkg.pay) throw new MemberError("Paket top-up tidak masuk akal.");
  const rows: { delta: number; reason: "topup" | "bonus" }[] = [{ delta: pkg.pay, reason: "topup" }];
  if (pkg.get > pkg.pay) rows.push({ delta: pkg.get - pkg.pay, reason: "bonus" });
  return rows;
}

export function ledgerTotal(rows: { delta: number }[]): number {
  return rows.reduce((s, r) => s + r.delta, 0);
}

/** Six digits, not all the same and not a straight run. Easy to type, not trivial to guess. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "PIN harus 6 angka.";
  if (/^(\d)\1{5}$/.test(pin)) return "PIN jangan angka yang sama semua.";
  if ("0123456789".includes(pin) || "9876543210".includes(pin)) return "PIN jangan angka berurutan.";
  return null;
}

/** "C00012": the member number printed on the card and encoded in its QR. */
export function memberNoFor(n: number): string {
  return `C${String(n).padStart(5, "0")}`;
}
