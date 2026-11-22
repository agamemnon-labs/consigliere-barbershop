import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { CheckoutError } from "@/domain/checkout";
import { creditFor, getReceipt, payAndFinish, todayTakings } from "./checkout";
import { enqueue } from "./enqueue";

const DAY = "2026-11-23";
const now = new Date(`${DAY}T15:00:00+08:00`);
let db: Database;
let cashier: { id: string; role: string; branchId: string | null };
let barberId: string;
let branchId: string;
let svc: Record<string, { id: string; variants: { id: string }[] }>;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
  const [user] = await db.select().from(s.users).where(eq(s.users.email, "kasir.juanda@consigliere.test"));
  if (!user?.branchId) throw new Error("no cashier");
  cashier = { id: user.id, role: user.role, branchId: user.branchId };
  branchId = user.branchId;
  const [shift] = await db
    .select()
    .from(s.barberShifts)
    .where(and(eq(s.barberShifts.branchId, branchId), eq(s.barberShifts.date, DAY)));
  if (!shift) throw new Error("no shift");
  barberId = shift.barberId;
  const services = await db.select().from(s.services);
  const variants = await db.select().from(s.serviceVariants);
  svc = Object.fromEntries(
    services.map((x) => [x.slug, { id: x.id, variants: variants.filter((v) => v.serviceId === x.id) }]),
  );
}, 60_000);

async function seated() {
  const entry = await db.transaction((tx) =>
    enqueue(tx, { branchId, barberId, date: DAY, source: "walkin", displayName: "Uji", estimatedMin: 30 }),
  );
  await db
    .update(s.queueEntries)
    .set({ status: "in_service", startedAt: now })
    .where(eq(s.queueEntries.id, entry.id));
  return entry.id;
}

describe("pay and finish at the counter", () => {
  it("records the bill, finishes the entry and shows on today's takings", async () => {
    const entryId = await seated();
    const before = await todayTakings(db, branchId, DAY);
    const id = await payAndFinish(
      db,
      {
        entryId,
        items: [
          { serviceId: svc.haircut!.id },
          { serviceId: svc["coloring-fashion"]!.id, price: 350_000 },
          { serviceId: svc["curly-perm"]!.id, variantId: svc["curly-perm"]!.variants[0]!.id },
        ],
        edc: "edc_qris",
      },
      cashier,
      now,
    );
    const receipt = await getReceipt(db, id);
    expect(receipt?.tx.method).toBe("edc_qris");
    expect(receipt?.tx.items.map((i) => i.name)).toEqual([
      "Haircut",
      "Coloring Fashion",
      "Curly Perm, Pendek",
    ]);
    expect(receipt?.tx.total).toBe((receipt?.tx.items[0]?.price ?? 0) + 350_000 + 400_000);

    const [entry] = await db.select().from(s.queueEntries).where(eq(s.queueEntries.id, entryId));
    expect(entry?.status).toBe("done");

    const after = await todayTakings(db, branchId, DAY);
    expect(after.total - before.total).toBe(receipt?.tx.total);
    expect(after.byMethod.edc_qris).toBeGreaterThan(0);
  });

  it("won't take payment twice for the same chair", async () => {
    const entryId = await seated();
    const input = { entryId, items: [{ serviceId: svc.haircut!.id }], edc: "edc_card" as const };
    await payAndFinish(db, input, cashier, now);
    await expect(payAndFinish(db, input, cashier, now)).rejects.toThrow("sudah dibayar");
  });

  it("refuses a 'from' price below the pricelist", async () => {
    const entryId = await seated();
    await expect(
      payAndFinish(
        db,
        { entryId, items: [{ serviceId: svc["coloring-fashion"]!.id, price: 30_000 }], edc: "edc_card" },
        cashier,
        now,
      ),
    ).rejects.toThrow(CheckoutError);
  });

  it("spends credit first and links it to the receipt", async () => {
    await db.insert(s.creditLedger).values({
      phone: "6281200000001",
      delta: 50_000,
      reason: "cancel",
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
    });
    expect(await creditFor(db, "6281200000001", now)).toBe(50_000);

    const entryId = await seated();
    const id = await payAndFinish(
      db,
      {
        entryId,
        items: [{ serviceId: svc.haircut!.id }],
        edc: "edc_card",
        phone: "0812-0000-0001",
        useCredit: 999_999,
      },
      cashier,
      now,
    );
    const receipt = await getReceipt(db, id);
    expect(receipt?.tx.method).toBe("mixed");
    expect(receipt?.creditUsed).toBe(50_000);
    expect(await creditFor(db, "6281200000001", now)).toBe(0);
  });

  it("keeps a cashier to their own branch", async () => {
    const entryId = await seated();
    await expect(
      payAndFinish(
        db,
        { entryId, items: [{ serviceId: svc.haircut!.id }], edc: "edc_card" },
        { ...cashier, branchId: "00000000-0000-0000-0000-000000000000" },
        now,
      ),
    ).rejects.toThrow("cabang lain");
  });
});
