import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb, DEMO_MEMBER_PIN } from "@/db/demo";
import * as s from "@/db/schema";
import { getReceipt, payAndFinish } from "./checkout";
import { enqueue } from "./enqueue";
import {
  checkPin,
  createMember,
  findMember,
  memberCard,
  requestPinReset,
  resetPin,
  topUp,
} from "./membership";

const DAY = "2026-11-23";
const now = new Date(`${DAY}T15:00:00+08:00`);
let db: Database;
let cashier: { id: string; role: string; branchId: string | null };
let barberId: string;
let branchId: string;
let haircutId: string;
let shaveId: string;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
  const [user] = await db
    .select()
    .from(s.users)
    .where(eq(s.users.email, "kasir.kalimantan@consigliere.test"));
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
  haircutId = services.find((x) => x.priceType === "by_level")!.id;
  shaveId = services.find((x) => x.priceType === "fixed" && x.category !== "haircut")!.id;
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

describe("demo members", () => {
  it("are seeded with points, balance and a birthday this month", async () => {
    const bram = await findMember(db, "C00001", now);
    expect(bram).toMatchObject({ name: "Bram Wicaksono", points: 25, balance: 0, birthday: true });
    const rizal = await findMember(db, "0812-0000-0002", now);
    expect(rizal).toMatchObject({ memberNo: "C00002", balance: 330_000, birthday: false });
  });
});

describe("sign-up and top-up at the counter", () => {
  it("creates a member, charges the fee and moves credit into balance", async () => {
    await db.insert(s.creditLedger).values({
      phone: "6281399990000",
      delta: 40_000,
      reason: "cancel",
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    const made = await createMember(
      db,
      { name: "Dimas", phone: "0813-9999-0000", dob: "1999-05-02", pin: "482913", edc: "edc_card" },
      cashier,
      now,
    );
    expect(made).toEqual({ memberNo: "C00003", creditMoved: 40_000 });
    const m = await findMember(db, "c00003", now);
    expect(m?.balance).toBe(40_000);

    await expect(
      createMember(
        db,
        { name: "Dimas", phone: "6281399990000", dob: "1999-05-02", pin: "482913", edc: "edc_card" },
        cashier,
        now,
      ),
    ).rejects.toThrow("sudah terdaftar");
  });

  it("refuses an easy PIN", async () => {
    await expect(
      createMember(
        db,
        { name: "X", phone: "081300000077", dob: "1999-05-02", pin: "123456", edc: "edc_card" },
        cashier,
        now,
      ),
    ).rejects.toThrow("berurutan");
  });

  it("tops up with the bonus on its own row", async () => {
    const m = await findMember(db, "C00003", now);
    const [pkg] = await db.select().from(s.topupPackages).where(eq(s.topupPackages.pay, 300_000));
    await topUp(db, { memberId: m!.id, packageId: pkg!.id, edc: "edc_qris" }, cashier, now);
    expect((await findMember(db, "C00003", now))?.balance).toBe(40_000 + 330_000);
  });
});

describe("paying as a member", () => {
  it("halves the haircut in the birthday month and earns points on what was paid", async () => {
    const bram = (await findMember(db, "C00001", now))!;
    const id = await payAndFinish(
      db,
      {
        entryId: await seated(),
        items: [{ serviceId: haircutId }, { serviceId: shaveId }],
        edc: "edc_card",
        member: { id: bram.id, birthday: true },
      },
      cashier,
      now,
    );
    const receipt = await getReceipt(db, id);
    const [cut, shave] = receipt!.tx.items;
    expect(cut!.discount).toBe(Math.floor(cut!.price / 2));
    expect(shave!.discount).toBe(0);
    expect(receipt!.tx.memberId).toBe(bram.id);
    const after = await findMember(db, "C00001", now);
    expect(after!.points).toBe(25 + Math.floor(receipt!.tx.total / 50_000));
  });

  it("won't stack the birthday discount with points", async () => {
    const bram = (await findMember(db, "C00001", now))!;
    await expect(
      payAndFinish(
        db,
        {
          entryId: await seated(),
          items: [{ serviceId: haircutId }],
          edc: "edc_card",
          member: { id: bram.id, birthday: true, redeemUnits: 1 },
        },
        cashier,
        now,
      ),
    ).rejects.toThrow("tidak bisa digabung");
  });

  it("redeems a voucher and pays the rest from balance with the PIN", async () => {
    const rizal = (await findMember(db, "C00002", now))!;
    await db.insert(s.pointLedger).values({ memberId: rizal.id, delta: 2, reason: "earn" });
    const id = await payAndFinish(
      db,
      {
        entryId: await seated(),
        items: [{ serviceId: haircutId }, { serviceId: shaveId }],
        edc: "edc_card",
        member: { id: rizal.id, redeemUnits: 1, balance: 999_999, pin: DEMO_MEMBER_PIN },
      },
      cashier,
      now,
    );
    const receipt = await getReceipt(db, id);
    expect(receipt!.tx.method).toBe("balance");
    expect(receipt!.tx.discounts).toBe(50_000);
    const after = (await findMember(db, "C00002", now))!;
    expect(after.balance).toBe(330_000 - receipt!.tx.total);
    expect(after.points).toBe(10 - 10 + Math.floor(receipt!.tx.total / 50_000));
  });

  it("locks the card after five wrong PINs", async () => {
    const rizal = (await findMember(db, "C00002", now))!;
    for (let i = 0; i < 5; i++) {
      await expect(checkPin(db, rizal.id, "000001", now)).rejects.toThrow("PIN salah");
    }
    await expect(checkPin(db, rizal.id, DEMO_MEMBER_PIN, now)).rejects.toThrow("Terlalu banyak");
    const later = new Date(now.getTime() + 16 * 60_000);
    await expect(checkPin(db, rizal.id, DEMO_MEMBER_PIN, later)).resolves.toBeUndefined();
  });
});

describe("forgot PIN", () => {
  it("resets with the WhatsApp code and clears the lock", async () => {
    const code = await requestPinReset(db, "0812-0000-0002", now);
    expect(code).toMatch(/^\d{6}$/);
    await expect(resetPin(db, "0812-0000-0002", "000000", "582914", now)).rejects.toThrow("Kode salah");
    await resetPin(db, "0812-0000-0002", code!, "582914", now);
    const rizal = (await findMember(db, "C00002", now))!;
    await expect(checkPin(db, rizal.id, "582914", now)).resolves.toBeUndefined();
    expect(await requestPinReset(db, "0899-1111-2222", now)).toBeNull();
  });

  it("shows the member their card and visits", async () => {
    const [user] = await db.select().from(s.users).where(eq(s.users.phoneNumber, "6281200000001"));
    const card = await memberCard(db, user!.id, now);
    expect(card?.memberNo).toBe("C00001");
    expect(card?.visits.length).toBeGreaterThan(0);
  });
});

describe("today's takings", () => {
  it("counts only new money; balance spent is listed apart", async () => {
    const { todayTakings } = await import("./checkout");
    const t = await todayTakings(db, branchId, DAY);
    expect(t.prepaid.balance).toBeGreaterThan(0);
    const sum = Object.values(t.byMethod).reduce((a: number, b) => a + (b ?? 0), 0);
    expect(t.total).toBe(sum);
    expect(t.byMethod.balance).toBeUndefined();
  });
});
