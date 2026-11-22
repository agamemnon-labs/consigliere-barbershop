/**
 * Counter payments. The shop is cashless: the EDC machine takes the card or
 * QRIS, and the cashier records what was paid. Credit (from a cancelled or
 * late online booking) can pay part or all of a bill.
 */

export type BillItem = { serviceId: string; name: string; price: number; discount: number };

export type Method = "edc_card" | "edc_qris" | "credit" | "balance" | "mixed";

export class CheckoutError extends Error {
  override name = "CheckoutError";
}

/** Largest single price a cashier may type for a "from" service. Guards against an extra zero. */
export const MAX_ITEM_PRICE = 5_000_000;

export function checkItems(items: BillItem[]): void {
  if (items.length === 0) throw new CheckoutError("Tagihan masih kosong.");
  for (const i of items) {
    if (!Number.isInteger(i.price) || i.price <= 0) throw new CheckoutError(`Harga ${i.name} belum benar.`);
    if (i.price > MAX_ITEM_PRICE)
      throw new CheckoutError(`Harga ${i.name} terlalu besar. Cek lagi angkanya.`);
    if (!Number.isInteger(i.discount) || i.discount < 0 || i.discount > i.price) {
      throw new CheckoutError(`Diskon ${i.name} belum benar.`);
    }
  }
}

export type Bill = {
  subtotal: number;
  discounts: number;
  total: number;
  /** Paid from credit (non-members, by phone number). */
  credit: number;
  /** Paid from a member's prepaid balance. */
  balance: number;
  /** Left for the EDC machine. */
  due: number;
  method: Method;
};

/**
 * Totals a bill and splits it: credit first, then balance, the rest on the EDC.
 * Each amount is what the customer agreed to use and never exceeds what is left.
 */
export function bill(
  items: BillItem[],
  edc: "edc_card" | "edc_qris",
  use: { credit?: number; balance?: number } = {},
): Bill {
  checkItems(items);
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const discounts = items.reduce((s, i) => s + i.discount, 0);
  const total = subtotal - discounts;
  const credit = Math.max(0, Math.min(Math.floor(use.credit ?? 0), total));
  const balance = Math.max(0, Math.min(Math.floor(use.balance ?? 0), total - credit));
  const due = total - credit - balance;
  const sources = [credit > 0, balance > 0, due > 0].filter(Boolean).length;
  const method: Method = sources > 1 ? "mixed" : credit > 0 ? "credit" : balance > 0 ? "balance" : edc;
  return { subtotal, discounts, total, credit, balance, due, method };
}

export type CreditRow = { delta: number; expiresAt: Date | null; createdAt: Date };

/**
 * Credit still usable on a phone number. Spending uses the credit that
 * expires first; whatever is left of an expired grant is gone.
 */
export function creditAvailable(rows: CreditRow[], now: Date): number {
  const grants = rows
    .filter((r) => r.delta > 0)
    .map((r) => ({ left: r.delta, expiresAt: r.expiresAt, createdAt: r.createdAt }))
    .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
  const spends = rows
    .filter((r) => r.delta < 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const spend of spends) {
    let owed = -spend.delta;
    for (const g of grants) {
      if (owed === 0) break;
      // A spend can only draw on credit that existed and was still valid at the time.
      if (g.createdAt > spend.createdAt) continue;
      if (g.expiresAt && g.expiresAt <= spend.createdAt) continue;
      const take = Math.min(g.left, owed);
      g.left -= take;
      owed -= take;
    }
  }
  return grants.filter((g) => !g.expiresAt || g.expiresAt > now).reduce((s, g) => s + g.left, 0);
}

export const METHOD_LABEL: Record<Method | "online_qris", string> = {
  edc_card: "EDC · kartu",
  edc_qris: "EDC · QRIS",
  online_qris: "QRIS online",
  credit: "Kredit",
  balance: "Saldo member",
  mixed: "EDC · gabungan",
};
