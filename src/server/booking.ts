import "server-only";
import { and, count, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import {
  BookingError,
  bookableOnline,
  type LineItem,
  onlineOpen,
  paidInTime,
  priceItem,
  shortestWait,
  totals,
} from "@/domain/booking";
import { ticketLabel } from "@/domain/queue";
import { shopDate, weekday } from "@/domain/time";
import { enqueue, numberSetting } from "@/server/enqueue";
import { type PaymentEvent, type PaymentProvider, paymentProvider } from "@/server/payments";
import { branchPrefix, getBranchQueue } from "@/server/queue";
import { ratingFor } from "@/server/rating";

/*
 * Online booking: price → pending booking + QRIS → paid webhook → queue entry.
 * A pending booking holds no place in line; the place is taken only when paid.
 */

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MAX_BOOKINGS_PER_PHONE_PER_DAY = 4;

export type BookingOptions = Awaited<ReturnType<typeof bookingOptions>>;

/** Everything the booking page needs for one branch: who is on, how long the wait, what can be prepaid. */
export async function bookingOptions(db: Database, branchSlug: string, now: Date) {
  const date = shopDate(now);
  const queue = await getBranchQueue(branchSlug, date, now, db);
  if (!queue) return null;
  const [branch] = await db.select().from(s.branches).where(eq(s.branches.slug, branchSlug));
  if (!branch) return null;
  const hours = branch.openHours[DAY_KEYS[weekday(date)] ?? "mon"];
  const closesBeforeMin = await numberSetting(db, "online_queue_closes_before_min", 45);

  const ids = queue.barbers.map((b) => b.barber.id);
  const levels = ids.length
    ? await db
        .select({ id: s.barbers.id, haircutPrice: s.barberLevels.haircutPrice })
        .from(s.barbers)
        .innerJoin(s.barberLevels, eq(s.barbers.levelId, s.barberLevels.id))
        .where(inArray(s.barbers.id, ids))
    : [];

  const services = await db.select().from(s.services).where(eq(s.services.isActive, true));
  const variants = await db.select().from(s.serviceVariants);

  return {
    branch: queue.branch,
    closedReason: queue.closedReason ?? (hours ? null : "Cabang ini tidak buka hari ini."),
    hours: hours ?? null,
    closesBeforeMin,
    /** Whether the online queue is taking numbers at this hour. */
    online: hours
      ? onlineOpen({
          now,
          open: hours[0],
          close: hours[1],
          closesBeforeMin,
          waitMin: 0,
          durationMin: 0,
        })
      : ({ ok: false, reason: "Cabang ini tidak buka hari ini." } as const),
    barbers: queue.barbers.map((b) => ({
      id: b.barber.id,
      slug: b.barber.slug,
      name: b.barber.name,
      level: b.barber.level,
      haircutPrice: levels.find((l) => l.id === b.barber.id)?.haircutPrice ?? 0,
      waitMin: b.waitMin,
      waiting: b.entries.length,
    })),
    services: services
      .filter(bookableOnline)
      .sort((a, b) => a.sort - b.sort)
      .map((svc) => ({
        id: svc.id,
        slug: svc.slug,
        name: svc.name,
        category: svc.category,
        description: svc.description,
        priceType: svc.priceType,
        price: svc.price,
        durationMin: svc.durationMin,
        variants: variants
          .filter((v) => v.serviceId === svc.id)
          .sort((a, b) => a.sort - b.sort)
          .map((v) => ({ id: v.id, name: v.name, price: v.price, durationMin: v.durationMin })),
      })),
  };
}

export type BookingInput = {
  branchSlug: string;
  /** A barber id, or "any" for the shortest wait. */
  barber: string;
  services: { serviceId: string; variantId?: string }[];
  name: string;
  phone: string;
};

/**
 * Prices the booking, saves it as pending and asks the gateway for a QRIS.
 * Returns the booking id. A phone with an unpaid booking still running gets that one back.
 */
export async function createBooking(
  db: Database,
  input: BookingInput,
  now: Date,
  payments: PaymentProvider,
  /** The public demo waives opening hours so it can be tried at any hour; real shops never do. */
  { enforceHours = true }: { enforceHours?: boolean } = {},
): Promise<string> {
  const options = await bookingOptions(db, input.branchSlug, now);
  if (!options) throw new BookingError("Cabang tidak ditemukan.");
  if (options.closedReason) throw new BookingError(options.closedReason);
  if (input.services.length === 0) throw new BookingError("Pilih minimal satu layanan.");

  const barber =
    input.barber === "any"
      ? shortestWait(options.barbers)
      : options.barbers.find((b) => b.id === input.barber);
  if (!barber) throw new BookingError("Barber ini tidak jaga hari ini. Pilih barber lain.");

  const items: LineItem[] = input.services.map((pick) => {
    const svc = options.services.find((x) => x.id === pick.serviceId);
    if (!svc) throw new BookingError("Layanan ini tidak bisa dipesan online.");
    return priceItem(svc, barber.haircutPrice, pick.variantId);
  });
  const { amount, durationMin } = totals(items);
  if (amount <= 0) throw new BookingError("Total pembayaran belum benar.");

  const open = options.hours
    ? onlineOpen({
        now,
        open: options.hours[0],
        close: options.hours[1],
        closesBeforeMin: options.closesBeforeMin,
        waitMin: barber.waitMin,
        durationMin,
      })
    : ({ ok: false, reason: "Cabang ini tidak buka hari ini." } as const);
  if (enforceHours && !open.ok) throw new BookingError(open.reason);

  const pendingMin = await numberSetting(db, "pending_booking_minutes", 15);
  const expiresAt = new Date(now.getTime() + pendingMin * 60_000);

  const booking = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.customers).where(eq(s.customers.phone, input.phone));
    const customer =
      existing ??
      (await tx.insert(s.customers).values({ name: input.name, phone: input.phone }).returning())[0];
    if (!customer) throw new Error("Customer was not saved");

    const [open] = await tx
      .select({ id: s.bookings.id })
      .from(s.bookings)
      .where(
        and(
          eq(s.bookings.customerId, customer.id),
          eq(s.bookings.status, "pending"),
          gte(s.bookings.expiresAt, now),
        ),
      );
    if (open) return { id: open.id, reused: true };

    const dayStart = new Date(`${shopDate(now)}T00:00:00+08:00`);
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(s.bookings)
      .where(and(eq(s.bookings.customerId, customer.id), gte(s.bookings.createdAt, dayStart)));
    if (n >= MAX_BOOKINGS_PER_PHONE_PER_DAY) {
      throw new BookingError("Nomor ini sudah terlalu sering memesan hari ini. Hubungi kasir, ya.");
    }

    const [row] = await tx
      .insert(s.bookings)
      .values({
        customerId: customer.id,
        branchId: options.branch.id,
        barberId: barber.id,
        services: items,
        amount,
        expiresAt,
      })
      .returning({ id: s.bookings.id });
    if (!row) throw new Error("Booking was not saved");
    return { id: row.id, reused: false };
  });
  if (booking.reused) return booking.id;

  const charge = await payments.createQris({
    reference: booking.id,
    amount,
    expiresAt,
    description: `${items.map((i) => i.name).join(", ")} · ${barber.name}, ${options.branch.name}`,
  });
  await db
    .update(s.bookings)
    .set({ paymentId: charge.paymentId, qrString: charge.qrString })
    .where(eq(s.bookings.id, booking.id));
  return booking.id;
}

export type Settlement = "queued" | "already" | "credited" | "ignored";

/**
 * Applies a gateway's payment news. Safe to call twice: a paid booking stays
 * paid and gets one place in line. Money for a booking that already expired
 * becomes credit on the customer's number instead of a place in line.
 */
export async function settlePayment(db: Database, event: PaymentEvent, now: Date): Promise<Settlement> {
  if (event.status !== "paid") return "ignored";
  return db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(s.bookings)
      .where(eq(s.bookings.id, event.reference))
      .for("update");
    if (!booking || booking.paymentId !== event.paymentId) return "ignored";
    if (event.amount !== null && event.amount !== booking.amount) return "ignored";
    if (booking.status === "paid" || booking.status === "credited") return "already";

    const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, booking.customerId));

    // Judge by when the customer paid, not when the news came: a webhook can be slow,
    // and expiry is only written on reads, so the stored status can lag either way.
    const waiting = booking.status === "pending" || booking.status === "expired";
    const inTime = paidInTime({ paidAt: event.paidAt ?? now, expiresAt: booking.expiresAt, now });
    if (!waiting || !inTime || !booking.barberId) {
      const days = await numberSetting(tx, "credit_valid_days", 30);
      if (customer?.phone) {
        await tx.insert(s.creditLedger).values({
          phone: customer.phone,
          delta: booking.amount,
          reason: "cancel",
          bookingId: booking.id,
          expiresAt: new Date(now.getTime() + days * 86_400_000),
        });
      }
      await tx
        .update(s.bookings)
        .set({ status: "credited", paidAt: now })
        .where(eq(s.bookings.id, booking.id));
      return "credited";
    }

    await enqueue(tx, {
      branchId: booking.branchId,
      barberId: booking.barberId,
      date: shopDate(now),
      source: "online",
      displayName: customer ? firstName(customer.name) : null,
      estimatedMin: Math.min(
        booking.services.reduce((sum, i) => sum + i.durationMin, 0),
        32_767,
      ),
      customerId: booking.customerId,
      bookingId: booking.id,
    });
    await tx.update(s.bookings).set({ status: "paid", paidAt: now }).where(eq(s.bookings.id, booking.id));
    return "queued";
  });
}

/**
 * Asks the gateway about bookings it never told us were paid, and settles the paid ones.
 * A safety net for a missed webhook; the webhook stays the normal path.
 */
export async function reconcileBookings(
  db: Database,
  payments: PaymentProvider,
  rows: { id: string; paymentId: string | null }[],
  now: Date,
): Promise<Settlement[]> {
  return Promise.all(
    rows.map(async ({ id, paymentId }) => {
      if (!paymentId) return "ignored";
      const news = await payments.getStatus(paymentId).catch((error: unknown) => {
        console.error("Payment status check failed", paymentId, error);
        return null;
      });
      if (news?.status !== "paid") return "ignored";
      return settlePayment(
        db,
        { reference: id, paymentId, status: "paid", amount: news.amount, paidAt: news.paidAt },
        now,
      );
    }),
  );
}

/**
 * Unpaid bookings past their time stop waiting. Runs on reads. With a real gateway it
 * first asks about the ones about to expire, so a missed webhook doesn't lose a paid place.
 */
export async function expireStale(db: Database, now: Date, payments: PaymentProvider = paymentProvider()) {
  if (payments.name !== "demo") {
    const due = await db
      .select({ id: s.bookings.id, paymentId: s.bookings.paymentId })
      .from(s.bookings)
      .where(
        and(eq(s.bookings.status, "pending"), lt(s.bookings.expiresAt, now), isNotNull(s.bookings.paymentId)),
      )
      .limit(10);
    await reconcileBookings(db, payments, due, now);
  }
  await db
    .update(s.bookings)
    .set({ status: "expired" })
    .where(and(eq(s.bookings.status, "pending"), lt(s.bookings.expiresAt, now)));
}

export type Ticket = NonNullable<Awaited<ReturnType<typeof getTicket>>>;

/** What the customer's ticket page shows for one booking. */
export async function getTicket(db: Database, bookingId: string, now: Date) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  await expireStale(db, now);
  const [row] = await db
    .select({ booking: s.bookings, branch: s.branches, customer: s.customers })
    .from(s.bookings)
    .innerJoin(s.branches, eq(s.bookings.branchId, s.branches.id))
    .innerJoin(s.customers, eq(s.bookings.customerId, s.customers.id))
    .where(eq(s.bookings.id, bookingId));
  if (!row) return null;
  const { booking, branch, customer } = row;

  const [barber] = booking.barberId
    ? await db.select({ name: s.barbers.name }).from(s.barbers).where(eq(s.barbers.id, booking.barberId))
    : [];
  const [entry] = await db.select().from(s.queueEntries).where(eq(s.queueEntries.bookingId, booking.id));

  let place: {
    ticket: string;
    prefix: string;
    number: number;
    status: string;
    ahead: number;
    waitMin: number;
  } | null = null;
  let rating: number | null = null;
  if (entry) {
    const prefix = branchPrefix(branch.name);
    const queue = await getBranchQueue(branch.slug, entry.date, now, db);
    const live = queue?.barbers.flatMap((b) => b.entries).find((e) => e.id === entry.id);
    place = {
      ticket: ticketLabel(prefix, entry.ticketNo),
      prefix,
      number: entry.ticketNo,
      status: live?.status ?? entry.status,
      ahead: live?.ahead ?? 0,
      waitMin: live?.waitMin ?? 0,
    };
    if (place.status === "done") rating = await ratingFor(db, entry.id);
  }

  return {
    id: booking.id,
    status: booking.status,
    amount: booking.amount,
    services: booking.services,
    qrString: booking.qrString,
    expiresAt: booking.expiresAt,
    branch: { id: branch.id, slug: branch.slug, name: branch.name },
    barber: barber?.name ?? null,
    name: firstName(customer.name),
    place,
    /** The customer's 1–5 for this visit, once given. */
    rating,
  };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0]?.slice(0, 20) ?? name;
}
