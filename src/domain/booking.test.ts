import { describe, expect, it } from "vitest";
import {
  BookingError,
  bookableOnline,
  leaveHint,
  normalizePhone,
  onlineOpen,
  paidInTime,
  phoneLabel,
  priceItem,
  shopMinutes,
  shortestWait,
  totals,
} from "./booking.ts";

/** 14:00 WITA on a given day. */
const at = (clock: string) => new Date(`2026-11-23T${clock}:00+08:00`);

describe("normalizePhone", () => {
  it.each([
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["81234567890", "6281234567890"],
    ["(0812) 345 678", "62812345678"],
  ])("reads %s", (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });

  it.each(["", "12345", "0212345678", "08abc", "08123456789012345"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("prints a number back the local way", () => {
    expect(phoneLabel("6281234567890")).toBe("0812-3456-7890");
  });
});

describe("pricing a booking", () => {
  const haircut = {
    id: "h",
    slug: "haircut",
    name: "Haircut",
    priceType: "by_level" as const,
    price: null,
    durationMin: 30,
    variants: [],
  };
  const shave = {
    ...haircut,
    id: "s",
    slug: "shave",
    name: "Shave",
    priceType: "fixed" as const,
    price: 70_000,
    durationMin: 20,
  };
  const perm = {
    ...haircut,
    id: "p",
    slug: "perm",
    name: "Curly Perm",
    priceType: "variant" as const,
    variants: [
      { id: "short", price: 400_000, durationMin: 90 },
      { id: "long", price: 600_000, durationMin: 120 },
    ],
  };

  it("prices a haircut by the barber's level and adds fixed services", () => {
    const items = [priceItem(haircut, 125_000), priceItem(shave, 125_000)];
    expect(totals(items)).toEqual({ amount: 195_000, durationMin: 50 });
  });

  it("takes the variant's own price and duration", () => {
    expect(priceItem(perm, 80_000, "long")).toMatchObject({
      price: 600_000,
      durationMin: 120,
      variantId: "long",
    });
    expect(() => priceItem(perm, 80_000)).toThrow(BookingError);
  });

  it("leaves 'from' prices to the counter", () => {
    expect(bookableOnline({ priceType: "from" })).toBe(false);
    expect(bookableOnline({ priceType: "variant" })).toBe(true);
  });
});

describe("onlineOpen", () => {
  const base = { open: "10:00", close: "21:00", closesBeforeMin: 45, waitMin: 0, durationMin: 30 };

  it("reads the clock in WITA", () => {
    expect(shopMinutes(at("14:05"))).toBe(14 * 60 + 5);
  });

  it("is open in the middle of the day", () => {
    expect(onlineOpen({ ...base, now: at("14:00") })).toEqual({ ok: true });
  });

  it("is closed before opening and from 45 minutes before closing", () => {
    expect(onlineOpen({ ...base, now: at("09:30") }).ok).toBe(false);
    expect(onlineOpen({ ...base, now: at("20:14") }).ok).toBe(true);
    expect(onlineOpen({ ...base, now: at("20:15") }).ok).toBe(false);
  });

  it("refuses a booking that would run past closing", () => {
    const r = onlineOpen({ ...base, now: at("19:00"), waitMin: 100, durationMin: 30 });
    expect(r).toEqual({ ok: false, reason: "Antrean barber ini sudah penuh sampai jam tutup." });
  });
});

describe("shortestWait", () => {
  it("picks the barber with the shortest wait, first listed on a tie", () => {
    const list = [
      { id: "a", waitMin: 30 },
      { id: "b", waitMin: 10 },
      { id: "c", waitMin: 10 },
    ];
    expect(shortestWait(list)?.id).toBe("b");
    expect(shortestWait([])).toBeUndefined();
  });
});

describe("leaveHint", () => {
  it("gives the turn time and when to set off", () => {
    expect(leaveHint(60, at("14:00"))).toEqual({ turnAt: "15.00", leaveAt: "14.35" });
  });

  it("says now when the wait is short", () => {
    expect(leaveHint(10, at("14:00")).leaveAt).toBeNull();
  });
});

describe("paidInTime", () => {
  const expiresAt = new Date("2026-11-23T06:15:00Z");
  const utc = (iso: string) => new Date(`2026-11-23T${iso}Z`);

  it("keeps the place for money paid inside the window", () => {
    expect(paidInTime({ paidAt: utc("06:14:59"), expiresAt, now: utc("06:14:59") })).toBe(true);
  });

  it("still keeps it when the news arrives a little late", () => {
    expect(paidInTime({ paidAt: utc("06:14:00"), expiresAt, now: utc("06:40:00") })).toBe(true);
  });

  it("turns money paid after the window into credit", () => {
    expect(paidInTime({ paidAt: utc("06:15:01"), expiresAt, now: utc("06:15:02") })).toBe(false);
  });

  it("turns very late news into credit, since the customer has gone", () => {
    expect(paidInTime({ paidAt: utc("06:14:00"), expiresAt, now: utc("06:46:00") })).toBe(false);
  });
});
