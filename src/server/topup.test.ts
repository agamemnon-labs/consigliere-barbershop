import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { takingsBetween } from "./checkout";
import { memberCard } from "./membership";
import { demoProvider } from "./payments";
import { createTopupOrder, getTopupOrder, settleTopup, topupPackages } from "./topup";

const DAY = "2026-11-23";
const now = new Date(`${DAY}T15:00:00+08:00`);
let db: Database;
let userId: string;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
  const [member] = await db.select().from(s.members).where(eq(s.members.memberNo, "C00001"));
  if (!member?.userId) throw new Error("no demo member");
  userId = member.userId;
}, 60_000);

describe("phone top-up", () => {
  it("adds balance only once the QRIS is paid, once", async () => {
    const [pkg] = (await topupPackages(db)).filter((p) => p.get > p.pay);
    if (!pkg) throw new Error("no bonus package");
    const before = (await memberCard(db, userId, now))!.balance;

    const id = await createTopupOrder(db, { userId, packageId: pkg.id }, now, demoProvider);
    expect(await createTopupOrder(db, { userId, packageId: pkg.id }, now, demoProvider)).toBe(id);
    const order = (await getTopupOrder(db, id, userId, now))!;
    expect(order).toMatchObject({ status: "pending", pay: pkg.pay, get: pkg.get });
    expect((await memberCard(db, userId, now))!.balance).toBe(before);

    const event = { reference: id, paymentId: order.paymentId!, status: "paid" as const, amount: pkg.pay };
    expect(await settleTopup(db, { ...event, amount: pkg.pay - 1 }, now)).toBe("ignored");
    expect(await settleTopup(db, event, now)).toBe("topped_up");
    expect(await settleTopup(db, event, now)).toBe("already");
    expect((await memberCard(db, userId, now))!.balance).toBe(before + pkg.get);

    const takings = await takingsBetween(db, null, DAY, DAY);
    expect(takings.byMethod.online_qris).toBeGreaterThanOrEqual(pkg.pay);
  });

  it("keeps someone else's top-up private", async () => {
    const [pkg] = await topupPackages(db);
    const id = await createTopupOrder(db, { userId, packageId: pkg!.id }, now, demoProvider);
    expect(await getTopupOrder(db, id, crypto.randomUUID(), now)).toBeNull();
  });

  it("still credits money that arrives after the QR expired", async () => {
    const [, pkg] = await topupPackages(db);
    const id = await createTopupOrder(db, { userId, packageId: pkg!.id }, now, demoProvider);
    const later = new Date(now.getTime() + 60 * 60_000);
    const order = (await getTopupOrder(db, id, userId, later))!;
    expect(order.status).toBe("expired");
    const event = { reference: id, paymentId: order.paymentId!, status: "paid" as const, amount: pkg!.pay };
    expect(await settleTopup(db, event, later)).toBe("topped_up");
  });
});
