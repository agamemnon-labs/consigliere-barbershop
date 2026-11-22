"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import * as q from "@/domain/queue";
import { shopDate } from "@/domain/time";
import { requireStaff, type Staff } from "@/server/session";

export type QueueActionState = { error?: string; ok?: number };

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

const DEFAULT_GRACE_MIN = 5;

/** One tap on the cashier screen: call, seat, finish, late or cancel an entry. */
export async function queueAction(
  op: "call" | "start" | "finish" | "late" | "cancel",
  entryId: string,
  _prev: QueueActionState,
): Promise<QueueActionState> {
  const staff = await requireStaff();
  const now = new Date();
  try {
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(s.queueEntries).where(eq(s.queueEntries.id, entryId));
      if (!target) throw new q.QueueError("Antrean tidak ditemukan.");
      assertBranch(staff, target.branchId);

      // Lock this barber's queue for the day so two taps can't interleave.
      const entries = await tx
        .select()
        .from(s.queueEntries)
        .where(and(eq(s.queueEntries.barberId, target.barberId), eq(s.queueEntries.date, target.date)))
        .for("update");

      const patches =
        op === "call"
          ? q.call(entries, entryId, now, await graceMinutes(tx))
          : op === "start"
            ? q.start(entries, entryId, now)
            : op === "finish"
              ? q.finish(entries, entryId, now)
              : op === "late"
                ? q.late(entries, entryId, now)
                : q.cancel(entries, entryId);

      for (const { id, ...patch } of patches) {
        await tx.update(s.queueEntries).set(patch).where(eq(s.queueEntries.id, id));
      }
    });
  } catch (error) {
    if (error instanceof q.QueueError || error instanceof BranchError) return { error: error.message };
    throw error;
  }
  revalidatePath("/kasir");
  return { ok: Date.now() };
}

const walkIn = z.object({
  barberId: z.uuid(),
  name: z.string().trim().max(40).optional(),
});

/** "+ Walk-in" on a barber column. Name is optional; the ticket number is what counts. */
export async function addWalkIn(_prev: QueueActionState, form: FormData): Promise<QueueActionState> {
  const staff = await requireStaff();
  const parsed = walkIn.safeParse({ barberId: form.get("barberId"), name: form.get("name") || undefined });
  if (!parsed.success) return { error: "Data walk-in belum benar." };
  const { barberId, name } = parsed.data;
  const date = shopDate();

  try {
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [shift] = await tx
        .select({ branchId: s.barberShifts.branchId, status: s.barberShifts.status })
        .from(s.barberShifts)
        .where(and(eq(s.barberShifts.barberId, barberId), eq(s.barberShifts.date, date)));
      if (!shift?.branchId || shift.status !== "on")
        throw new q.QueueError("Barber ini tidak jaga hari ini.");
      assertBranch(staff, shift.branchId);

      const entries = await tx
        .select()
        .from(s.queueEntries)
        .where(and(eq(s.queueEntries.barberId, barberId), eq(s.queueEntries.date, date)))
        .for("update");
      const [{ last } = { last: 0 }] = await tx
        .select({ last: max(s.queueEntries.ticketNo) })
        .from(s.queueEntries)
        .where(and(eq(s.queueEntries.branchId, shift.branchId), eq(s.queueEntries.date, date)));
      const [haircut] = await tx
        .select({ durationMin: s.services.durationMin })
        .from(s.services)
        .where(eq(s.services.slug, "haircut"));

      await tx.insert(s.queueEntries).values({
        branchId: shift.branchId,
        barberId,
        date,
        position: q.nextPosition(entries),
        ticketNo: (last ?? 0) + 1,
        displayName: name ?? null,
        source: "walkin",
        estimatedMin: haircut?.durationMin ?? 30,
      });
    });
  } catch (error) {
    if (error instanceof q.QueueError || error instanceof BranchError) return { error: error.message };
    throw error;
  }
  revalidatePath("/kasir");
  return { ok: Date.now() };
}

class BranchError extends Error {}

/** Cashiers work their own branch; admin and owner can work any. */
function assertBranch(staff: Staff, branchId: string) {
  if (staff.role === "cashier" && staff.branchId !== branchId) {
    throw new BranchError("Antrean ini milik cabang lain.");
  }
}

async function graceMinutes(tx: Tx): Promise<number> {
  const [row] = await tx.select().from(s.settings).where(eq(s.settings.key, "queue_grace_minutes"));
  return typeof row?.value === "number" ? row.value : DEFAULT_GRACE_MIN;
}
