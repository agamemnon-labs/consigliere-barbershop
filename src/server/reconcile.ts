import "server-only";
import { and, gte, inArray, isNotNull } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { reconcileBookings, type Settlement } from "@/server/booking";
import type { PaymentProvider } from "@/server/payments";
import { reconcileTopups, type TopupSettlement } from "@/server/topup";

/** How far back the sweep looks. A QRIS can't be paid after it expires, and ours last 15 minutes. */
const LOOKBACK_HOURS = 24;
const MAX_PER_RUN = 50;

/**
 * Sweeps recent unpaid bookings and top-ups and asks the gateway about each.
 * For a webhook that never arrived and a page nobody reopened. Safe to run any time.
 */
export async function reconcileRecent(db: Database, payments: PaymentProvider, now: Date) {
  if (payments.name === "demo") return { bookings: {}, topups: {} };
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000);
  const unpaid = ["pending", "expired"] as const;

  const bookings = await db
    .select({ id: s.bookings.id, paymentId: s.bookings.paymentId })
    .from(s.bookings)
    .where(
      and(
        inArray(s.bookings.status, [...unpaid]),
        isNotNull(s.bookings.paymentId),
        gte(s.bookings.createdAt, since),
      ),
    )
    .limit(MAX_PER_RUN);
  const topups = await db
    .select({ id: s.topupOrders.id, paymentId: s.topupOrders.paymentId })
    .from(s.topupOrders)
    .where(
      and(
        inArray(s.topupOrders.status, [...unpaid]),
        isNotNull(s.topupOrders.paymentId),
        gte(s.topupOrders.createdAt, since),
      ),
    )
    .limit(MAX_PER_RUN);

  return {
    bookings: tally(await reconcileBookings(db, payments, bookings, now)),
    topups: tally(await reconcileTopups(db, payments, topups, now)),
  };
}

function tally<T extends Settlement | TopupSettlement>(results: T[]): Partial<Record<T, number>> {
  const out: Partial<Record<T, number>> = {};
  for (const r of results) out[r] = (out[r] ?? 0) + 1;
  return out;
}
