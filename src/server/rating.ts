import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { type RatingSummary, type Score, summarizeRatings } from "@/domain/rating";

export type RateResult = "saved" | "already" | "not_done" | "missing";

/**
 * The customer's score for their own finished visit, from the ticket page. The booking id is
 * the key (only the phone that booked has it); one score per visit, the first one stays.
 */
export async function rateVisit(db: Database, bookingId: string, score: Score): Promise<RateResult> {
  const [entry] = await db
    .select({
      id: s.queueEntries.id,
      status: s.queueEntries.status,
      barberId: s.queueEntries.barberId,
      branchId: s.queueEntries.branchId,
      date: s.queueEntries.date,
    })
    .from(s.queueEntries)
    .where(eq(s.queueEntries.bookingId, bookingId));
  if (!entry) return "missing";
  if (entry.status !== "done") return "not_done";
  const saved = await db
    .insert(s.ratings)
    .values({
      queueEntryId: entry.id,
      barberId: entry.barberId,
      branchId: entry.branchId,
      date: entry.date,
      score,
    })
    .onConflictDoNothing({ target: s.ratings.queueEntryId })
    .returning({ id: s.ratings.id });
  return saved.length ? "saved" : "already";
}

/** The score already given for one visit, if any. */
export async function ratingFor(db: Database, queueEntryId: string): Promise<number | null> {
  const [row] = await db
    .select({ score: s.ratings.score })
    .from(s.ratings)
    .where(eq(s.ratings.queueEntryId, queueEntryId));
  return row?.score ?? null;
}

/** Per barber for the report: average, count and spread over the visit dates in range. */
export async function ratingsBetween(
  db: Database,
  from: string,
  to: string,
): Promise<(RatingSummary & { name: string })[]> {
  const [rows, barbers] = await Promise.all([
    db
      .select({ barberId: s.ratings.barberId, score: s.ratings.score })
      .from(s.ratings)
      .where(and(gte(s.ratings.date, from), lte(s.ratings.date, to))),
    db.select({ id: s.barbers.id, name: s.barbers.name }).from(s.barbers),
  ]);
  return summarizeRatings(rows).map((r) => ({
    ...r,
    name: barbers.find((b) => b.id === r.barberId)?.name ?? "Barber",
  }));
}
