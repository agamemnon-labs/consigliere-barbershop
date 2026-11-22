/** Money is always integer rupiah. These helpers only format; they never round prices. */

const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 80000 → "Rp80.000" */
export function formatRupiah(amount: number): string {
  assertRupiah(amount);
  const sign = amount < 0 ? "−" : "";
  return `${sign}Rp${rupiah.format(Math.abs(amount))}`;
}

/** 80000 → "80K", 1250000 → "1,25 jt". The pricelist shorthand barbershops use. */
export function formatShort(amount: number): string {
  assertRupiah(amount);
  if (amount >= 1_000_000) {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(amount / 1_000_000)} jt`;
  }
  if (amount >= 1_000 && amount % 1_000 === 0) return `${amount / 1_000}K`;
  return rupiah.format(amount);
}

function assertRupiah(amount: number) {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Amount must be whole rupiah, got ${amount}`);
  }
}
