import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { bookingOptions, createBooking, getTicket, settlePayment } from "./booking";
import { demoProvider } from "./payments";
import { rateVisit, ratingsBetween } from "./rating";

const DAY = "2026-11-23";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+08:00`);
let db: Database;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
}, 60_000);

/** A paid online haircut that is now in the queue. */
async function paidVisit(phone: string) {
  const options = await bookingOptions(db, "belatuk", at("14:00"));
  const haircut = options?.services.find((x) => x.slug === "haircut");
  if (!haircut) throw new Error("no haircut");
  const id = await createBooking(
    db,
    { branchSlug: "belatuk", barber: "any", services: [{ serviceId: haircut.id }], name: "Raka", phone },
    at("14:00"),
    demoProvider,
  );
  const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!booking?.paymentId) throw new Error("no booking");
  await settlePayment(
    db,
    { reference: id, paymentId: booking.paymentId, status: "paid", amount: booking.amount },
    at("14:01"),
  );
  return id;
}

async function finish(bookingId: string) {
  await db
    .update(s.queueEntries)
    .set({ status: "done", finishedAt: at("14:40") })
    .where(eq(s.queueEntries.bookingId, bookingId));
}

describe("rating a visit", () => {
  it("waits until the cut is done", async () => {
    const id = await paidVisit("6285550000001");
    expect(await rateVisit(db, id, 5)).toBe("not_done");
  });

  it("keeps the first score, shows it on the ticket and in the barber's report", async () => {
    const id = await paidVisit("6285550000002");
    await finish(id);
    expect(await rateVisit(db, id, 4)).toBe("saved");
    expect(await rateVisit(db, id, 1)).toBe("already");

    const ticket = await getTicket(db, id, at("14:45"));
    expect(ticket?.place?.status).toBe("done");
    expect(ticket?.rating).toBe(4);

    const [entry] = await db.select().from(s.queueEntries).where(eq(s.queueEntries.bookingId, id));
    const report = await ratingsBetween(db, DAY, DAY);
    const row = report.find((r) => r.barberId === entry?.barberId);
    expect(row).toMatchObject({ count: 1, average: 4, spread: [0, 0, 0, 1, 0] });
  });

  it("knows nothing about a booking that never joined the queue", async () => {
    expect(await rateVisit(db, crypto.randomUUID(), 5)).toBe("missing");
  });

  it("seeds four weeks of demo ratings for the report", async () => {
    const report = await ratingsBetween(db, "2026-10-26", "2026-11-22");
    expect(report.length).toBeGreaterThan(5);
    for (const r of report) {
      expect(r.average).toBeGreaterThanOrEqual(1);
      expect(r.average).toBeLessThanOrEqual(5);
    }
  });
});
