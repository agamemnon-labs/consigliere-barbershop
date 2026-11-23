import "server-only";
import { and, eq } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { numberSetting, type Tx } from "@/server/enqueue";
import type { PaymentProvider } from "@/server/payments";

/**
 * Why a prepaid place in line ended without a haircut. From the brief: the
 * customer cancelling or not showing up keeps the money with us (30-day credit
 * on the number, or balance for a member); the shop cancelling gives it all back.
 */
export type Unserved = "customer_cancel" | "no_show" | "shop_cancel";

type Charge = { paymentId: string; reference: string; amount: number };

export type Release =
  | { kind: "none" }
  | { kind: "credit" | "balance"; amount: number }
  | { kind: "refund"; charge: Charge };

/**
 * Inside the queue transaction: books what happens to a paid booking's money.
 * A refund is only marked here; call `sendRefund` after the transaction commits.
 */
export async function releasePrepaid(
  tx: Tx,
  bookingId: string | null,
  why: Unserved,
  now: Date,
): Promise<Release> {
  if (!bookingId) return { kind: "none" };
  const [booking] = await tx.select().from(s.bookings).where(eq(s.bookings.id, bookingId)).for("update");
  if (booking?.status !== "paid") return { kind: "none" };

  if (why === "shop_cancel" && booking.paymentId) {
    await tx.update(s.bookings).set({ status: "refunded" }).where(eq(s.bookings.id, booking.id));
    return {
      kind: "refund",
      charge: { paymentId: booking.paymentId, reference: booking.id, amount: booking.amount },
    };
  }
  return keepAsCredit(tx, booking, why === "no_show" ? "no_show" : "cancel", now);
}

async function keepAsCredit(
  tx: Tx,
  booking: typeof s.bookings.$inferSelect,
  reason: "cancel" | "no_show",
  now: Date,
): Promise<Release> {
  const [member] = await tx
    .select({ id: s.members.id })
    .from(s.members)
    .where(and(eq(s.members.customerId, booking.customerId), eq(s.members.status, "active")));
  if (member) {
    await tx.insert(s.balanceLedger).values({
      memberId: member.id,
      delta: booking.amount,
      reason: "refund",
      ref: `booking:${booking.id}`,
      createdAt: now,
    });
  } else {
    const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, booking.customerId));
    if (!customer?.phone) return { kind: "none" };
    const days = await numberSetting(tx, "credit_valid_days", 30);
    await tx.insert(s.creditLedger).values({
      phone: customer.phone,
      delta: booking.amount,
      reason,
      bookingId: booking.id,
      expiresAt: new Date(now.getTime() + days * 86_400_000),
      createdAt: now,
    });
  }
  await tx.update(s.bookings).set({ status: "credited" }).where(eq(s.bookings.id, booking.id));
  return { kind: member ? "balance" : "credit", amount: booking.amount };
}

/**
 * Sends a marked refund to the gateway. If the gateway refuses, the money is not
 * lost: it becomes credit (or balance) instead, and the admin can refund by hand.
 */
export async function sendRefund(
  db: Database,
  payments: PaymentProvider,
  charge: Charge,
  now: Date,
): Promise<Release> {
  try {
    await payments.refund(charge);
    return { kind: "refund", charge };
  } catch (error) {
    // Any failure (refused, timed out, network): the customer's money must not vanish.
    console.error("Refund failed, keeping the money as credit", charge.reference, error);
    return db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(s.bookings)
        .where(eq(s.bookings.id, charge.reference))
        .for("update");
      if (booking?.status !== "refunded") return { kind: "none" } as const;
      return keepAsCredit(tx, booking, "cancel", now);
    });
  }
}
