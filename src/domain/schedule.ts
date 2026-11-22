import { addDays, weekday } from "./time.ts";

export type Shift = {
  barberId: string;
  date: string;
  status: "on" | "off";
  branchId: string | null;
};

export type Closure = { branchId: string | null; date: string; reason: string };

export type DayPlan =
  | { date: string; kind: "working"; branchId: string }
  | { date: string; kind: "off" }
  | { date: string; kind: "closed"; branchId: string; reason: string }
  | { date: string; kind: "unknown" };

/** The closure that applies to a branch on a date: its own, or an all-branch one. */
export function closureFor(closures: Closure[], branchId: string, date: string): Closure | undefined {
  return closures.find((c) => c.date === date && (c.branchId === null || c.branchId === branchId));
}

/**
 * One barber's days from `from`, for `days` days. A day with no shift row is
 * "unknown" (rotation not planned yet), never assumed working.
 */
export function barberWeek(
  barberId: string,
  shifts: Shift[],
  closures: Closure[],
  from: string,
  days = 7,
): DayPlan[] {
  const mine = new Map(shifts.filter((s) => s.barberId === barberId).map((s) => [s.date, s]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const shift = mine.get(date);
    if (!shift) return { date, kind: "unknown" };
    if (shift.status === "off" || !shift.branchId) return { date, kind: "off" };
    const closed = closureFor(closures, shift.branchId, date);
    if (closed) return { date, kind: "closed", branchId: shift.branchId, reason: closed.reason };
    return { date, kind: "working", branchId: shift.branchId };
  });
}

/** Barbers working at a branch on a date (none if the branch is closed). */
export function onDuty(shifts: Shift[], closures: Closure[], branchId: string, date: string): string[] {
  if (closureFor(closures, branchId, date)) return [];
  return shifts
    .filter((s) => s.date === date && s.status === "on" && s.branchId === branchId)
    .map((s) => s.barberId);
}

/** The weekday names of a barber's regular days off seen in a plan, e.g. ["Senin"]. */
export function daysOff(plan: DayPlan[]): string[] {
  const names = plan.filter((d) => d.kind === "off").map((d) => DAY_NAMES[weekday(d.date)] ?? "");
  return [...new Set(names)];
}

export const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;

/** "Sen, 23 Nov" */
export function shortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${DAY_SHORT[weekday(date)]}, ${d} ${MONTHS[(m ?? 1) - 1]}`;
}
