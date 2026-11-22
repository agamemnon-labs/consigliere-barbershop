import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { BookingError } from "@/domain/booking";
import { bookingOptions, createBooking, expireStale, getTicket, settlePayment } from "./booking";
import { demoProvider } from "./payments";

const DAY = "2026-11-23";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+08:00`);
let db: Database;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
}, 60_000);

async function haircutFor(branch: string, phone: string, barber = "any") {
  const options = await bookingOptions(db, branch, at("14:00"));
  const haircut = options?.services.find((x) => x.slug === "haircut");
  if (!haircut) throw new Error("no haircut");
  const id = await createBooking(
    db,
    { branchSlug: branch, barber, services: [{ serviceId: haircut.id }], name: "Bima Sakti", phone },
    at("14:00"),
    demoProvider,
  );
  const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!booking?.paymentId) throw new Error("no booking");
  return booking;
}

describe("online booking", () => {
  it("offers only prepayable services and the barbers on duty", async () => {
    const options = await bookingOptions(db, "juanda", at("14:00"));
    expect(options?.barbers.length).toBeGreaterThan(0);
    expect(options?.services.some((x) => x.priceType === "from")).toBe(false);
    expect(options?.services.find((x) => x.slug === "curly-perm")?.variants).toHaveLength(2);
  });

  it("prices by the chosen barber's level and holds no place until paid", async () => {
    const booking = await haircutFor("juanda", "6281111111111");
    const options = await bookingOptions(db, "juanda", at("14:00"));
    const barber = options?.barbers.find((b) => b.id === booking.barberId);
    expect(booking.status).toBe("pending");
    expect(booking.amount).toBe(barber?.haircutPrice);
    expect(booking.qrString).toContain("CONSIGLIERE-DEMO");
    const entries = await db.select().from(s.queueEntries).where(eq(s.queueEntries.bookingId, booking.id));
    expect(entries).toHaveLength(0);
  });

  it("gives back the same unpaid booking instead of a second QR", async () => {
    const first = await haircutFor("pramuka", "6282222222222");
    const again = await haircutFor("pramuka", "6282222222222");
    expect(again.id).toBe(first.id);
  });

  it("joins the queue once when paid, even if the webhook comes twice", async () => {
    const booking = await haircutFor("tepian", "6283333333333");
    const event = {
      reference: booking.id,
      paymentId: booking.paymentId ?? "",
      status: "paid" as const,
      amount: booking.amount,
    };
    expect(await settlePayment(db, event, at("14:01"))).toBe("queued");
    expect(await settlePayment(db, event, at("14:02"))).toBe("already");

    const entries = await db.select().from(s.queueEntries).where(eq(s.queueEntries.bookingId, booking.id));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: "online", status: "waiting", displayName: "Bima" });

    const ticket = await getTicket(db, booking.id, at("14:02"));
    expect(ticket?.status).toBe("paid");
    expect(ticket?.place?.ticket).toMatch(/^T \d{3}$/);
  });

  it("ignores news that doesn't match the booking", async () => {
    const booking = await haircutFor("juanda", "6284444444444");
    const base = { reference: booking.id, status: "paid" as const, amount: booking.amount };
    expect(await settlePayment(db, { ...base, paymentId: "someone-else" }, at("14:01"))).toBe("ignored");
    expect(
      await settlePayment(db, { ...base, paymentId: booking.paymentId ?? "", amount: 1 }, at("14:01")),
    ).toBe("ignored");
    expect(
      await settlePayment(db, { ...base, paymentId: booking.paymentId ?? "", status: "failed" }, at("14:01")),
    ).toBe("ignored");
  });

  it("turns money for an expired booking into 30-day credit on the number", async () => {
    const booking = await haircutFor("juanda", "6285555555555");
    await expireStale(db, at("14:30"));
    const result = await settlePayment(
      db,
      { reference: booking.id, paymentId: booking.paymentId ?? "", status: "paid", amount: booking.amount },
      at("14:31"),
    );
    expect(result).toBe("credited");
    const credit = await db
      .select()
      .from(s.creditLedger)
      .where(and(eq(s.creditLedger.phone, "6285555555555"), eq(s.creditLedger.bookingId, booking.id)));
    expect(credit[0]?.delta).toBe(booking.amount);
  });

  it("stops taking numbers 45 minutes before closing", async () => {
    const options = await bookingOptions(db, "juanda", at("20:20"));
    const haircut = options?.services.find((x) => x.slug === "haircut");
    await expect(
      createBooking(
        db,
        {
          branchSlug: "juanda",
          barber: "any",
          services: [{ serviceId: haircut?.id ?? "" }],
          name: "Late",
          phone: "6286666666666",
        },
        at("20:20"),
        demoProvider,
      ),
    ).rejects.toThrow(BookingError);
  });
});

describe("the public demo", () => {
  it("can waive opening hours so visitors can try it at night", async () => {
    const options = await bookingOptions(db, "juanda", at("23:30"));
    expect(options?.online.ok).toBe(false);
    const haircut = options?.services.find((x) => x.slug === "haircut");
    const id = await createBooking(
      db,
      {
        branchSlug: "juanda",
        barber: "any",
        services: [{ serviceId: haircut?.id ?? "" }],
        name: "Malam",
        phone: "6287777777777",
      },
      at("23:30"),
      demoProvider,
      { enforceHours: false },
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
