import "server-only";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { type Database, schema as s } from "@/db";

export type OnlinePayment = {
  id: string;
  kind: "booking" | "topup";
  who: string;
  /** Member number for a top-up, branch name for a booking. */
  detail: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "credited" | "refunded";
  paymentId: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

/**
 * Every QRIS charge customers started online in the last `days`, newest first:
 * queue bookings and member top-ups together, for matching against the gateway's report.
 */
export async function onlinePayments(db: Database, now: Date, days = 7): Promise<OnlinePayment[]> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const bookings = await db
    .select({ booking: s.bookings, customer: s.customers.name, branch: s.branches.name })
    .from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .innerJoin(s.branches, eq(s.branches.id, s.bookings.branchId))
    .where(and(gte(s.bookings.createdAt, since), isNotNull(s.bookings.paymentId)))
    .orderBy(desc(s.bookings.createdAt))
    .limit(300);
  const topups = await db
    .select({ order: s.topupOrders, memberNo: s.members.memberNo, customer: s.customers.name })
    .from(s.topupOrders)
    .innerJoin(s.members, eq(s.members.id, s.topupOrders.memberId))
    .innerJoin(s.customers, eq(s.customers.id, s.members.customerId))
    .where(and(gte(s.topupOrders.createdAt, since), isNotNull(s.topupOrders.paymentId)))
    .orderBy(desc(s.topupOrders.createdAt))
    .limit(300);

  return [
    ...bookings.map(
      ({ booking: b, customer, branch }): OnlinePayment => ({
        id: b.id,
        kind: "booking",
        who: customer,
        detail: branch,
        amount: b.amount,
        status: b.status,
        paymentId: b.paymentId,
        createdAt: b.createdAt,
        paidAt: b.paidAt,
      }),
    ),
    ...topups.map(
      ({ order: o, memberNo, customer }): OnlinePayment => ({
        id: o.id,
        kind: "topup",
        who: customer,
        detail: memberNo,
        amount: o.pay,
        status: o.status,
        paymentId: o.paymentId,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      }),
    ),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Money that actually came in: paid charges, including late ones kept as credit. */
export function receivedTotal(rows: OnlinePayment[]): number {
  return rows
    .filter((r) => r.status === "paid" || r.status === "credited")
    .reduce((sum, r) => sum + r.amount, 0);
}
