/**
 * Ratings: after a finished visit the customer gives the barber 1 to 5 from their ticket.
 * One score per visit. Pure functions: parsing what the phone sent, and the per-barber
 * summary the back office shows.
 */

export const SCORES = [1, 2, 3, 4, 5] as const;
export type Score = (typeof SCORES)[number];

/** A score from a form or an action argument, or null when it isn't a whole number 1–5. */
export function parseScore(value: unknown): Score | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Score) : null;
}

export type RatingLine = { barberId: string; score: number };

export type RatingSummary = {
  barberId: string;
  count: number;
  /** Mean score rounded to one decimal, e.g. 4.6. */
  average: number;
  /** How many of each score, index 0 = one star … index 4 = five stars. */
  spread: [number, number, number, number, number];
};

/** Per barber: count, average and spread, best average first (more ratings wins a tie). */
export function summarizeRatings(lines: RatingLine[]): RatingSummary[] {
  const by = new Map<string, RatingSummary & { total: number }>();
  for (const l of lines) {
    const score = parseScore(l.score);
    if (!score) continue;
    const row = by.get(l.barberId) ?? {
      barberId: l.barberId,
      count: 0,
      total: 0,
      average: 0,
      spread: [0, 0, 0, 0, 0],
    };
    row.count += 1;
    row.total += score;
    row.spread[score - 1] = (row.spread[score - 1] ?? 0) + 1;
    by.set(l.barberId, row);
  }
  return [...by.values()]
    .map(({ total, ...r }) => ({ ...r, average: Math.round((total / r.count) * 10) / 10 }))
    .sort((a, b) => b.average - a.average || b.count - a.count);
}

/** "4,6": one decimal with the Indonesian comma. */
export function formatAverage(average: number): string {
  return average.toFixed(1).replace(".", ",");
}
