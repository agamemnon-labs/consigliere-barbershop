import { and, eq, sum } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { bookingOptions, createBooking, settlePayment } from "./booking";
import { demoProvider, PaymentError, type PaymentProvider } from "./payments";
import { releasePrepaid, sendRefund } from "./release";

const DAY = "2026-11-23";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+08:00`);
let db: Database;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
}, 60_000);

/** A paid online booking for this phone, already in the queue. */
async function paidBooking(phone: string) {
  const options = await bookingOptions(db, "pulau-kalimantan", at("14:00"));
  const haircut = options?.services.find((x) => x.slug === "haircut");
  const id = await createBooking(
    db,
    {
      branchSlug: "pulau-kalimantan",
      barber: "any",
      services: [{ serviceId: haircut!.id }],
      name: "Sari",
      phone,
    },
    at("14:00"),
    demoProvider,
  );
  const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  await settlePayment(
    db,
    { reference: id, paymentId: booking!.paymentId!, status: "paid", amount: booking!.amount },
    at("14:01"),
  );
  return booking!;
}

const credit = async (phone: string) =>
  Number(
    (
      await db
        .select({ n: sum(s.creditLedger.delta) })
        .from(s.creditLedger)
        .where(eq(s.creditLedger.phone, phone))
    )[0]?.n ?? 0,
  );

describe("money for a prepaid place that ends unserved", () => {
  it("becomes 30-day credit when the customer cancels, once", async () => {
    const booking = await paidBooking("6289911110001");
    const release = await db.transaction((tx) =>
      releasePrepaid(tx, booking.id, "customer_cancel", at("14:10")),
    );
    expect(release).toEqual({ kind: "credit", amount: booking.amount });
    expect(await credit("6289911110001")).toBe(booking.amount);
    // A second tap gives nothing more.
    await db.transaction((tx) => releasePrepaid(tx, booking.id, "customer_cancel", at("14:11")));
    expect(await credit("6289911110001")).toBe(booking.amount);
  });

  it("becomes credit for a no-show too", async () => {
    const booking = await paidBooking("6289911110002");
    await db.transaction((tx) => releasePrepaid(tx, booking.id, "no_show", at("15:00")));
    const [row] = await db
      .select()
      .from(s.creditLedger)
      .where(and(eq(s.creditLedger.bookingId, booking.id), eq(s.creditLedger.reason, "no_show")));
    expect(row?.delta).toBe(booking.amount);
  });

  it("goes into a member's balance instead of credit", async () => {
    const [member] = await db
      .select({ id: s.members.id, phone: s.customers.phone })
      .from(s.members)
      .innerJoin(s.customers, eq(s.customers.id, s.members.customerId))
      .where(eq(s.members.memberNo, "C00001"));
    const booking = await paidBooking(member!.phone!);
    const release = await db.transaction((tx) =>
      releasePrepaid(tx, booking.id, "customer_cancel", at("14:10")),
    );
    expect(release.kind).toBe("balance");
    const [row] = await db
      .select()
      .from(s.balanceLedger)
      .where(eq(s.balanceLedger.ref, `booking:${booking.id}`));
    expect(row).toMatchObject({ memberId: member!.id, delta: booking.amount, reason: "refund" });
  });

  it("is refunded through the gateway when the shop cancels", async () => {
    const booking = await paidBooking("6289911110003");
    const release = await db.transaction((tx) => releasePrepaid(tx, booking.id, "shop_cancel", at("14:10")));
    expect(release.kind).toBe("refund");
    if (release.kind !== "refund") return;
    expect(await sendRefund(db, demoProvider, release.charge, at("14:10"))).toMatchObject({ kind: "refund" });
    const [after] = await db.select().from(s.bookings).where(eq(s.bookings.id, booking.id));
    expect(after?.status).toBe("refunded");
    expect(await credit("6289911110003")).toBe(0);
  });

  it("falls back to credit when the gateway refuses the refund", async () => {
    const booking = await paidBooking("6289911110004");
    const release = await db.transaction((tx) => releasePrepaid(tx, booking.id, "shop_cancel", at("14:10")));
    if (release.kind !== "refund") throw new Error("expected a refund");
    const refusing: PaymentProvider = {
      ...demoProvider,
      async refund() {
        throw new PaymentError("nope");
      },
    };
    expect(await sendRefund(db, refusing, release.charge, at("14:10"))).toMatchObject({ kind: "credit" });
    expect(await credit("6289911110004")).toBe(booking.amount);
  });

  it("does nothing for a walk-in", async () => {
    expect(await db.transaction((tx) => releasePrepaid(tx, null, "shop_cancel", at("14:10")))).toEqual({
      kind: "none",
    });
  });
});
