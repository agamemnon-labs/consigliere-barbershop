/**
 * Reports and back-office rules: sales by branch, barber, service and method,
 * barber commission, CSV export, and the weekly rotation grid.
 * Pure functions; the server reads rows and hands them in.
 */
import { addDays, weekday } from "./time.ts";

/** One service sold, from a counter bill or a paid online booking. */
export type SaleLine = {
  date: string;
  branchId: string;
  barberId: string | null;
  serviceId: string;
  name: string;
  category: string;
  /** What the shop earned on it: price minus discount. */
  amount: number;
  source: "counter" | "online";
};

/** Money that came in, by how it came in. Balance and credit are not new money. */
export type CashLine = { date: string; branchId: string; method: string; amount: number };

export type Totals = { key: string; count: number; amount: number };

/** Groups lines by a key, biggest first. */
export function groupBy<T extends { amount: number }>(lines: T[], key: (l: T) => string): Totals[] {
  const map = new Map<string, Totals>();
  for (const l of lines) {
    const k = key(l);
    const t = map.get(k) ?? { key: k, count: 0, amount: 0 };
    t.count += 1;
    t.amount += l.amount;
    map.set(k, t);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
}

export function sum(lines: { amount: number }[]): number {
  return lines.reduce((s, l) => s + l.amount, 0);
}

/** A barber's level over time; the newest row on or before a date wins. */
export type LevelRow = { barberId: string; levelId: string; effectiveFrom: string };

export function levelOn(history: LevelRow[], barberId: string, date: string): string | null {
  let best: LevelRow | null = null;
  for (const row of history) {
    if (row.barberId !== barberId || row.effectiveFrom > date) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  return best?.levelId ?? null;
}

export type CommissionRule = {
  /** Haircut share per level, basis points (4000 = 40%). */
  haircutBps: Record<string, number>;
  /** Share on every other service. */
  otherBps: number;
};

export type Commission = { barberId: string; sales: number; commission: number; services: number };

/**
 * Barber commission on what was actually earned per service. Haircuts use the
 * barber's level on the day of the sale, so a promotion never rewrites the past.
 */
export function commissions(lines: SaleLine[], history: LevelRow[], rule: CommissionRule): Commission[] {
  const map = new Map<string, Commission>();
  for (const l of lines) {
    if (!l.barberId) continue;
    const level = levelOn(history, l.barberId, l.date);
    const bps = l.category === "haircut" && level ? (rule.haircutBps[level] ?? rule.otherBps) : rule.otherBps;
    const c = map.get(l.barberId) ?? { barberId: l.barberId, sales: 0, commission: 0, services: 0 };
    c.sales += l.amount;
    c.services += 1;
    // Rounded down per line, so the shop never pays a fraction of a rupiah.
    c.commission += Math.floor((l.amount * bps) / 10_000);
    map.set(l.barberId, c);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

/** CSV with a header row; quotes only what needs quoting. Opens cleanly in Excel and Sheets. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/** The Monday of the week a date falls in. */
export function mondayOf(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** A rotation cell: a branch id, or "off". */
export type Cell = { barberId: string; date: string; value: string };

/** Last week's plan moved forward seven days, for "Salin minggu lalu". */
export function copyWeek(previous: Cell[], fromMonday: string): Cell[] {
  const dates = new Set(weekDates(fromMonday));
  return previous.filter((c) => dates.has(c.date)).map((c) => ({ ...c, date: addDays(c.date, 7) }));
}

/** Inclusive date range check, with a sane cap so a report can't scan years by accident. */
export function checkRange(from: string, to: string, maxDays = 366): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "Tanggal belum benar";
  if (from > to) return "Tanggal awal setelah tanggal akhir";
  if (addDays(from, maxDays) < to) return `Maksimal ${maxDays} hari`;
  return null;
}

/** A back-office input that can't be saved; the message is shown as is. */
export class AdminError extends Error {
  override name = "AdminError";
}
