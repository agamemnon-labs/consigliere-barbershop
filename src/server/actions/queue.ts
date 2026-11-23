"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import * as q from "@/domain/queue";
import { shopDate } from "@/domain/time";
import { enqueue, numberSetting, type Tx } from "@/server/enqueue";
import { alertNearTurnsLater } from "@/server/notify-after";
import { paymentProvider } from "@/server/payments";
import { type Release, releasePrepaid, sendRefund, type Unserved } from "@/server/release";
import { requireStaff, type Staff } from "@/server/session";

export type QueueActionState = { error?: string; ok?: number };

const DEFAULT_GRACE_MIN = 5;

/**
 * One tap on the cashier screen: call, seat, finish, late or cancel an entry.
 * `cancel` is the customer cancelling; `shop_cancel` is the shop, which refunds a prepaid place.
 */
export async function queueAction(
  op: "call" | "start" | "finish" | "late" | "cancel" | "shop_cancel",
  entryId: string,
  _prev: QueueActionState,
): Promise<QueueActionState> {
  const staff = await requireStaff();
  const now = new Date();
  let release = { kind: "none" } as Release;
  let line: { barberId: string; date: string } | undefined;
  try {
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(s.queueEntries).where(eq(s.queueEntries.id, entryId));
      if (!target) throw new q.QueueError("Antrean tidak ditemukan.");
      assertBranch(staff, target.branchId);
      line = { barberId: target.barberId, date: target.date };

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
        if (patch.status === "cancelled" || patch.status === "no_show") {
          const why: Unserved =
            op === "shop_cancel" ? "shop_cancel" : patch.status === "no_show" ? "no_show" : "customer_cancel";
          const entry = entries.find((e) => e.id === id);
          release = await releasePrepaid(tx, entry?.bookingId ?? null, why, now);
        }
      }
    });
    if (release.kind === "refund") release = await sendRefund(db, paymentProvider(), release.charge, now);
  } catch (error) {
    if (error instanceof q.QueueError || error instanceof BranchError) return { error: error.message };
    throw error;
  }
  if (line) alertNearTurnsLater(line.barberId, line.date);
  revalidatePath("/kasir");
  return { ok: Date.now() };
}

const walkIn = z.object({
  barberId: z.uuid(),
  name: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(20).optional(),
});

/**
 * "+ Walk-in" on a barber column. Name and WhatsApp are optional; the ticket number
 * is what counts. With a WhatsApp number the customer can step out and gets a
 * message when two people are left ahead.
 */
export async function addWalkIn(_prev: QueueActionState, form: FormData): Promise<QueueActionState> {
  const staff = await requireStaff();
  const parsed = walkIn.safeParse({
    barberId: form.get("barberId"),
    name: form.get("name") || undefined,
    phone: form.get("phone") || undefined,
  });
  if (!parsed.success) return { error: "Data walk-in belum benar." };
  const { barberId, name } = parsed.data;
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { error: "Nomor WhatsApp belum benar." };
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

      const [haircut] = await tx
        .select({ durationMin: s.services.durationMin })
        .from(s.services)
        .where(eq(s.services.slug, "haircut"));
      await enqueue(tx, {
        branchId: shift.branchId,
        barberId,
        date,
        source: "walkin",
        displayName: name ?? null,
        estimatedMin: haircut?.durationMin ?? 30,
        customerId: phone ? await customerFor(tx, phone, name) : null,
      });
    });
  } catch (error) {
    if (error instanceof q.QueueError || error instanceof BranchError) return { error: error.message };
    throw error;
  }
  revalidatePath("/kasir");
  return { ok: Date.now() };
}

/** The customer behind a WhatsApp number, created on first visit. */
async function customerFor(tx: Tx, phone: string, name: string | undefined): Promise<string> {
  const [found] = await tx
    .select({ id: s.customers.id })
    .from(s.customers)
    .where(eq(s.customers.phone, phone));
  if (found) return found.id;
  const [made] = await tx
    .insert(s.customers)
    .values({ phone, name: name ?? "Tamu" })
    .returning({ id: s.customers.id });
  if (!made) throw new Error("Customer was not inserted");
  return made.id;
}

class BranchError extends Error {}

/** Cashiers work their own branch; admin and owner can work any. */
function assertBranch(staff: Staff, branchId: string) {
  if (staff.role === "cashier" && staff.branchId !== branchId) {
    throw new BranchError("Antrean ini milik cabang lain.");
  }
}

function graceMinutes(tx: Tx): Promise<number> {
  return numberSetting(tx, "queue_grace_minutes", DEFAULT_GRACE_MIN);
}
