import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { bookingOptions, createBooking, settlePayment } from "./booking";
import { onlinePayments, receivedTotal } from "./online-payments";
import { demoProvider } from "./payments";
import { createTopupOrder, topupPackages } from "./topup";

const DAY = "2026-11-23";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+08:00`);
let db: Database;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
}, 60_000);

describe("online payments list", () => {
  it("lists bookings and top-ups together, newest first, and counts only money that came in", async () => {
    const options = await bookingOptions(db, "pulau-kalimantan", at("14:00"));
    const haircut = options?.services.find((x) => x.slug === "haircut");
    const bookingId = await createBooking(
      db,
      {
        branchSlug: "pulau-kalimantan",
        barber: "any",
        services: [{ serviceId: haircut!.id }],
        name: "Dewi",
        phone: "6289900000001",
      },
      at("14:00"),
      demoProvider,
    );
    const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
    await settlePayment(
      db,
      { reference: bookingId, paymentId: booking!.paymentId!, status: "paid", amount: booking!.amount },
      at("14:01"),
    );

    const [member] = await db.select().from(s.members).where(eq(s.members.memberNo, "C00001"));
    const [pkg] = await topupPackages(db);
    await createTopupOrder(db, { userId: member!.userId!, packageId: pkg!.id }, at("14:05"), demoProvider);

    // A booking's createdAt is the real clock, a top-up's the test clock, so don't rely on order here.
    const rows = await onlinePayments(db, at("14:10"));
    const topup = rows.find((r) => r.kind === "topup" && r.detail === "C00001" && r.status === "pending");
    const paid = rows.find((r) => r.id === bookingId);
    expect(topup).toMatchObject({ amount: pkg!.pay });
    expect(paid).toMatchObject({ kind: "booking", status: "paid", who: "Dewi", amount: booking!.amount });
    expect(receivedTotal([topup!, paid!])).toBe(booking!.amount);
    const times = rows.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
