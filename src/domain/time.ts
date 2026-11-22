/**
 * All "today" logic runs in WITA (Asia/Makassar, UTC+8, no DST), wherever the
 * server happens to be.
 */
export const SHOP_TZ = "Asia/Makassar";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clock = new Intl.DateTimeFormat("id-ID", {
  timeZone: SHOP_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The shop's calendar date for an instant, as YYYY-MM-DD. */
export function shopDate(at: Date = new Date()): string {
  return ymd.format(at);
}

/** "14.40", the way a clock time reads in Indonesian. */
export function shopClock(at: Date): string {
  return clock.format(at).replace(":", ".");
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD date. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
