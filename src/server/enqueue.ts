import "server-only";
import { and, eq, max } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { shortLineAtJoin } from "@/domain/notify";
import { activeEntries, nextPosition } from "@/domain/queue";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Puts someone at the back of a barber's line for the day. Locks that line so
 * two inserts can't take the same position, and numbers tickets per branch per day.
 */
export async function enqueue(
  tx: Tx,
  entry: {
    branchId: string;
    barberId: string;
    date: string;
    source: "online" | "walkin";
    displayName: string | null;
    estimatedMin: number;
    customerId?: string | null;
    bookingId?: string | null;
  },
) {
  const line = await tx
    .select()
    .from(s.queueEntries)
    .where(and(eq(s.queueEntries.barberId, entry.barberId), eq(s.queueEntries.date, entry.date)))
    .for("update");
  const [{ last } = { last: 0 }] = await tx
    .select({ last: max(s.queueEntries.ticketNo) })
    .from(s.queueEntries)
    .where(and(eq(s.queueEntries.branchId, entry.branchId), eq(s.queueEntries.date, entry.date)));
  const [row] = await tx
    .insert(s.queueEntries)
    .values({
      ...entry,
      position: nextPosition(line),
      ticketNo: (last ?? 0) + 1,
      // Joining a line that is already short: they can see it, so no "near" message later.
      nearAlertAt: shortLineAtJoin(activeEntries(line).length) ? new Date() : null,
    })
    .returning();
  if (!row) throw new Error("Queue entry was not inserted");
  return row;
}

/** A number setting from the settings table, or its default. */
export async function numberSetting(tx: Tx | Database, key: string, fallback: number): Promise<number> {
  const [row] = await tx.select().from(s.settings).where(eq(s.settings.key, key));
  return typeof row?.value === "number" ? row.value : fallback;
}
