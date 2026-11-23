import { shopClock } from "./time.ts";

/**
 * Online booking rules. "Queue now" only: the customer pays, then joins the
 * barber's queue behind whoever is there, walk-ins included.
 */

/**
 * A WhatsApp number as 62… digits, or null when it can't be one.
 * Accepts the ways people type it: 0812…, +62 812…, 62812…, 812….
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  const local = digits.startsWith("62") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  // Indonesian mobile numbers start with 8 and have 9 to 12 digits after the country code.
  if (!/^8\d{8,11}$/.test(local)) return null;
  return `62${local}`;
}

/** "0812-3456-7890" style, for showing a number back to its owner. */
export function phoneLabel(phone: string): string {
  const local = `0${phone.slice(2)}`;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

export type BookingService = {
  slug: string;
  priceType: "fixed" | "from" | "by_level" | "variant";
  price: number | null;
  durationMin: number;
  variants: { id: string; price: number; durationMin: number }[];
};

export type LineItem = {
  serviceId: string;
  variantId?: string;
  name: string;
  price: number;
  durationMin: number;
};

export class BookingError extends Error {
  override name = "BookingError";
}

/** Online booking can only prepay services with a known price. "From" prices are settled at the counter. */
export function bookableOnline(service: { priceType: BookingService["priceType"] }): boolean {
  return service.priceType !== "from";
}

/** Price one chosen service for a barber of the given haircut price. */
export function priceItem(
  service: BookingService & { id: string; name: string },
  haircutPrice: number,
  variantId?: string,
): LineItem {
  switch (service.priceType) {
    case "by_level":
      return {
        serviceId: service.id,
        name: service.name,
        price: haircutPrice,
        durationMin: service.durationMin,
      };
    case "fixed":
      if (service.price === null) throw new BookingError(`${service.name} belum punya harga.`);
      return {
        serviceId: service.id,
        name: service.name,
        price: service.price,
        durationMin: service.durationMin,
      };
    case "variant": {
      const v = service.variants.find((x) => x.id === variantId);
      if (!v) throw new BookingError(`Pilih ukuran untuk ${service.name}.`);
      return {
        serviceId: service.id,
        variantId: v.id,
        name: service.name,
        price: v.price,
        durationMin: v.durationMin,
      };
    }
    case "from":
      throw new BookingError(`${service.name} dibayar di kasir, karena harganya tergantung rambut.`);
  }
}

export function totals(items: LineItem[]): { amount: number; durationMin: number } {
  return items.reduce(
    (t, i) => ({ amount: t.amount + i.price, durationMin: t.durationMin + i.durationMin }),
    { amount: 0, durationMin: 0 },
  );
}

/** Minutes since midnight WITA. */
export function shopMinutes(at: Date): number {
  const [h = "0", m = "0"] = shopClock(at).split(".");
  return Number(h) * 60 + Number(m);
}

function minutesOf(clock: string): number {
  const [h = "0", m = "0"] = clock.split(/[:.]/);
  return Number(h) * 60 + Number(m);
}

export type OnlineCheck = { ok: true } | { ok: false; reason: string };

/**
 * Can this barber still take an online number right now?
 * Closed before opening, from `closesBeforeMin` before closing, and when the
 * queue plus this booking would run past closing.
 */
export function onlineOpen(opts: {
  now: Date;
  open: string;
  close: string;
  closesBeforeMin: number;
  waitMin: number;
  durationMin: number;
}): OnlineCheck {
  const now = shopMinutes(opts.now);
  const open = minutesOf(opts.open);
  const close = minutesOf(opts.close);
  if (now < open) return { ok: false, reason: `Antrean online buka jam ${opts.open.replace(":", ".")}.` };
  if (now >= close - opts.closesBeforeMin) {
    return { ok: false, reason: "Antrean online sudah tutup untuk hari ini. Datang langsung masih bisa." };
  }
  if (now + opts.waitMin + opts.durationMin > close) {
    return { ok: false, reason: "Antrean barber ini sudah penuh sampai jam tutup." };
  }
  return { ok: true };
}

/** "Any barber": the one with the shortest wait; ties go to the first listed. */
export function shortestWait<T extends { waitMin: number }>(barbers: T[]): T | undefined {
  return barbers.reduce<T | undefined>(
    (best, b) => (best && best.waitMin <= b.waitMin ? best : b),
    undefined,
  );
}

/**
 * When to set off. The estimate is never a promise, so we suggest arriving
 * ten minutes early. `leaveAt` is null when that time has already come ("now").
 */
export function leaveHint(
  waitMin: number,
  now: Date,
  travelMin = 15,
): { turnAt: string; leaveAt: string | null } {
  const turn = new Date(now.getTime() + waitMin * 60_000);
  const leaveAt = new Date(turn.getTime() - (travelMin + 10) * 60_000);
  return {
    turnAt: shopClock(turn),
    leaveAt: leaveAt.getTime() <= now.getTime() ? null : shopClock(leaveAt),
  };
}
