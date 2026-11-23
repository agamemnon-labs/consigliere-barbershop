import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { MemberError, topupRows } from "@/domain/membership";
import { numberSetting } from "@/server/enqueue";
import type { PaymentEvent, PaymentProvider } from "@/server/payments";

/** At most this many unpaid top-ups a member can start in one hour. */
const MAX_PER_HOUR = 5;

/**
 * A member starts a top-up from the phone: one QRIS for the package price.
 * The balance is added only when the payment arrives (see settleTopup).
 * An unpaid order for the same package is reused instead of making a new QR.
 */
export async function createTopupOrder(
  db: Database,
  input: { userId: string; packageId: string },
  now: Date,
  payments: PaymentProvider,
): Promise<string> {
  const [member] = await db.select().from(s.members).where(eq(s.members.userId, input.userId));
  if (!member) throw new MemberError("Kartu belum ditemukan.");
  if (member.status !== "active") throw new MemberError("Kartu ini sedang dinonaktifkan.");
  const [pkg] = await db
    .select()
    .from(s.topupPackages)
    .where(and(eq(s.topupPackages.id, input.packageId), eq(s.topupPackages.isActive, true)));
  if (!pkg) throw new MemberError("Paket top-up tidak ditemukan.");

  const [open] = await db
    .select({ id: s.topupOrders.id })
    .from(s.topupOrders)
    .where(
      and(
        eq(s.topupOrders.memberId, member.id),
        eq(s.topupOrders.status, "pending"),
        eq(s.topupOrders.pay, pkg.pay),
        gte(s.topupOrders.expiresAt, now),
      ),
    );
  if (open) return open.id;

  const recent = await db
    .select({ id: s.topupOrders.id })
    .from(s.topupOrders)
    .where(
      and(
        eq(s.topupOrders.memberId, member.id),
        gte(s.topupOrders.createdAt, new Date(now.getTime() - 3_600_000)),
      ),
    );
  if (recent.length >= MAX_PER_HOUR) throw new MemberError("Terlalu sering. Coba lagi sejam lagi, ya.");

  const minutes = await numberSetting(db, "pending_booking_minutes", 15);
  const expiresAt = new Date(now.getTime() + minutes * 60_000);
  const [row] = await db
    .insert(s.topupOrders)
    .values({ memberId: member.id, pay: pkg.pay, get: pkg.get, expiresAt, createdAt: now })
    .returning({ id: s.topupOrders.id });
  if (!row) throw new Error("Top-up was not saved");

  const charge = await payments.createQris({
    reference: row.id,
    amount: pkg.pay,
    expiresAt,
    description: `Top-up saldo ${member.memberNo}`,
  });
  await db
    .update(s.topupOrders)
    .set({ paymentId: charge.paymentId, qrString: charge.qrString })
    .where(eq(s.topupOrders.id, row.id));
  return row.id;
}

export type TopupSettlement = "topped_up" | "already" | "ignored";

/**
 * Applies a gateway's payment news to a top-up. Safe to call twice. Money that
 * arrives after the QR expired still becomes balance: the member paid, and
 * balance never expires.
 */
export async function settleTopup(db: Database, event: PaymentEvent, now: Date): Promise<TopupSettlement> {
  if (event.status !== "paid") return "ignored";
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(s.topupOrders)
      .where(eq(s.topupOrders.id, event.reference))
      .for("update");
    if (!order || order.paymentId !== event.paymentId) return "ignored";
    if (event.amount !== null && event.amount !== order.pay) return "ignored";
    if (order.status === "paid") return "already";

    const [member] = await tx.select().from(s.members).where(eq(s.members.id, order.memberId));
    if (!member) return "ignored";
    // No counter for an online top-up: book it to where the member last visited, or the first branch.
    const [last] = await tx
      .select({ branchId: s.transactions.branchId })
      .from(s.transactions)
      .where(eq(s.transactions.memberId, member.id))
      .orderBy(desc(s.transactions.createdAt))
      .limit(1);
    const [first] = await tx.select({ id: s.branches.id }).from(s.branches).orderBy(asc(s.branches.name));
    const branchId = last?.branchId ?? first?.id;
    if (!branchId) throw new Error("No branch");

    const [row] = await tx
      .insert(s.transactions)
      .values({
        branchId,
        customerId: member.customerId,
        memberId: member.id,
        items: [
          {
            serviceId: "topup",
            name: `Top-up saldo (dapat ${order.get.toLocaleString("id-ID")})`,
            price: order.pay,
            discount: 0,
          },
        ],
        subtotal: order.pay,
        total: order.pay,
        method: "online_qris",
        createdAt: now,
      })
      .returning({ id: s.transactions.id });
    if (!row) throw new Error("Transaction was not saved");
    await tx
      .insert(s.balanceLedger)
      .values(
        topupRows(order).map((r) => ({ ...r, memberId: member.id, transactionId: row.id, createdAt: now })),
      );
    await tx
      .update(s.topupOrders)
      .set({ status: "paid", paidAt: now, transactionId: row.id })
      .where(eq(s.topupOrders.id, order.id));
    return "topped_up";
  });
}

/** One of the member's own top-ups, for its pay page. Unpaid ones past their time show as expired. */
export async function getTopupOrder(db: Database, id: string, userId: string, now: Date) {
  await db
    .update(s.topupOrders)
    .set({ status: "expired" })
    .where(and(eq(s.topupOrders.status, "pending"), lt(s.topupOrders.expiresAt, now)));
  const [row] = await db
    .select({ order: s.topupOrders, memberNo: s.members.memberNo })
    .from(s.topupOrders)
    .innerJoin(s.members, eq(s.members.id, s.topupOrders.memberId))
    .where(and(eq(s.topupOrders.id, id), eq(s.members.userId, userId)));
  return row ? { ...row.order, memberNo: row.memberNo } : null;
}

/** Active packages, cheapest first, for the phone top-up screen. */
export async function topupPackages(db: Database) {
  return db
    .select()
    .from(s.topupPackages)
    .where(eq(s.topupPackages.isActive, true))
    .orderBy(asc(s.topupPackages.pay));
}
