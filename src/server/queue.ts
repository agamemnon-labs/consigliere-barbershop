import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { type Database, getDb, schema as s } from "@/db";
import { activeEntries, estimates, ticketLabel, waitForNewcomer } from "@/domain/queue";
import { closureFor, onDuty } from "@/domain/schedule";

/** Ticket prefix for a branch: its initial ("Juanda" → "J"). */
export function branchPrefix(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export type LiveEntry = {
  id: string;
  ticket: string;
  displayName: string | null;
  source: "online" | "walkin";
  status: "waiting" | "called" | "in_service";
  calledAt: Date | null;
  graceUntil: Date | null;
  startedAt: Date | null;
  lateMoves: number;
  estimatedMin: number;
  ahead: number;
  waitMin: number;
};

export type BarberQueue = {
  barber: { id: string; slug: string; name: string; level: string; haircutPrice: number };
  entries: LiveEntry[];
  /** Minutes a newcomer would wait. */
  waitMin: number;
};

export type BranchQueue = {
  branch: { id: string; slug: string; name: string; prefix: string };
  closedReason: string | null;
  barbers: BarberQueue[];
};

/** Live queue for one branch on one day. Never cached: it changes every few minutes. */
export async function getBranchQueue(
  branchSlug: string,
  date: string,
  now: Date,
  database?: Database,
): Promise<BranchQueue | null> {
  const db = database ?? (await getDb());
  const [branch] = await db.select().from(s.branches).where(eq(s.branches.slug, branchSlug));
  if (!branch) return null;

  const [shifts, closures] = await Promise.all([
    db
      .select({
        barberId: s.barberShifts.barberId,
        date: s.barberShifts.date,
        status: s.barberShifts.status,
        branchId: s.barberShifts.branchId,
      })
      .from(s.barberShifts)
      .where(eq(s.barberShifts.date, date)),
    db
      .select({ branchId: s.closures.branchId, date: s.closures.date, reason: s.closures.reason })
      .from(s.closures)
      .where(eq(s.closures.date, date)),
  ]);
  const closed = closureFor(closures, branch.id, date);
  const dutyIds = onDuty(shifts, closures, branch.id, date);

  const [barbers, entries] = await Promise.all([
    dutyIds.length
      ? db
          .select({
            id: s.barbers.id,
            slug: s.barbers.slug,
            name: s.barbers.name,
            level: s.barberLevels.name,
            haircutPrice: s.barberLevels.haircutPrice,
            levelSort: s.barberLevels.sort,
          })
          .from(s.barbers)
          .innerJoin(s.barberLevels, eq(s.barbers.levelId, s.barberLevels.id))
          .where(inArray(s.barbers.id, dutyIds))
      : Promise.resolve([]),
    db
      .select()
      .from(s.queueEntries)
      .where(and(eq(s.queueEntries.branchId, branch.id), eq(s.queueEntries.date, date)))
      .orderBy(asc(s.queueEntries.position)),
  ]);

  const prefix = branchPrefix(branch.name);
  return {
    branch: { id: branch.id, slug: branch.slug, name: branch.name, prefix },
    closedReason: closed?.reason ?? null,
    barbers: barbers
      .sort((a, b) => b.levelSort - a.levelSort || a.name.localeCompare(b.name))
      .map(({ levelSort: _, ...barber }) => {
        const mine = entries.filter((e) => e.barberId === barber.id);
        const est = estimates(mine, now);
        return {
          barber,
          waitMin: waitForNewcomer(mine, now),
          entries: activeEntries(mine).map((e) => ({
            id: e.id,
            ticket: ticketLabel(prefix, e.ticketNo),
            displayName: e.displayName,
            source: e.source,
            status: e.status as LiveEntry["status"],
            calledAt: e.calledAt,
            graceUntil: e.graceUntil,
            startedAt: e.startedAt,
            lateMoves: e.lateMoves,
            estimatedMin: e.estimatedMin,
            ahead: est.get(e.id)?.ahead ?? 0,
            waitMin: est.get(e.id)?.waitMin ?? 0,
          })),
        };
      }),
  };
}
