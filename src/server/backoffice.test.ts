import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { buildReport, todayOverview } from "./admin";
import {
  adjustMember,
  changeLevel,
  copyLastWeek,
  memberDetail,
  memberList,
  rotationWeek,
  rules,
  saveRotation,
  saveRules,
  updateMember,
  updateService,
} from "./backoffice";
import { payAndFinish } from "./checkout";
import { enqueue } from "./enqueue";

const DAY = "2026-11-23"; // a Monday
const now = new Date(`${DAY}T15:00:00+08:00`);
let db: Database;
let admin: { id: string };
let cashier: { id: string; role: string; branchId: string | null };

beforeAll(async () => {
  db = (await createDemoDb({
    from: "2026-11-16",
    days: 14,
    staffPassword: "x".repeat(12),
  })) as unknown as Database;
  const [a] = await db.select().from(s.users).where(eq(s.users.email, "admin@consigliere.test"));
  const [c] = await db.select().from(s.users).where(eq(s.users.email, "kasir.kalimantan@consigliere.test"));
  if (!a || !c) throw new Error("no staff");
  admin = { id: a.id };
  cashier = { id: c.id, role: c.role, branchId: c.branchId };
}, 60_000);

describe("rotation", () => {
  it("shows the week and saves a changed cell only", async () => {
    const week = await rotationWeek(db, DAY);
    expect(week.dates).toHaveLength(7);
    const row = week.rows[0]!;
    const other = week.branches.find((b) => b.id !== row.cells[0])!.id;
    const changed = await saveRotation(
      db,
      [
        { barberId: row.id, date: DAY, value: other },
        { barberId: row.id, date: week.dates[1]!, value: row.cells[1]! },
      ],
      admin,
    );
    expect(changed).toBe(1);
    expect((await rotationWeek(db, DAY)).rows[0]!.cells[0]).toBe(other);
  });

  it("refuses an unknown branch", async () => {
    const week = await rotationWeek(db, DAY);
    await expect(
      saveRotation(db, [{ barberId: week.rows[0]!.id, date: DAY, value: crypto.randomUUID() }], admin),
    ).rejects.toThrow("Cabang");
  });

  it("copies last week onto next week", async () => {
    const next = "2026-11-30";
    await copyLastWeek(db, next, admin);
    const [prev, copied] = await Promise.all([rotationWeek(db, DAY), rotationWeek(db, next)]);
    expect(copied.rows.map((r) => r.cells)).toEqual(prev.rows.map((r) => r.cells));
  });
});

describe("prices and levels", () => {
  it("updates a fixed price and refuses nonsense", async () => {
    const [svc] = await db.select().from(s.services).where(eq(s.services.priceType, "fixed"));
    await updateService(
      db,
      { id: svc!.id, price: 77_000, durationMin: 25, isActive: true, variants: [] },
      admin,
    );
    const [after] = await db.select().from(s.services).where(eq(s.services.id, svc!.id));
    expect(after?.price).toBe(77_000);
    await expect(
      updateService(db, { id: svc!.id, price: -1, durationMin: 25, isActive: true, variants: [] }, admin),
    ).rejects.toThrow("Harga");
  });

  it("changes a level from today and keeps the history", async () => {
    const [barber] = await db.select().from(s.barbers);
    const levels = await db.select().from(s.barberLevels);
    const other = levels.find((l) => l.id !== barber!.levelId)!;
    await expect(
      changeLevel(db, { barberId: barber!.id, levelId: other.id, from: "2026-01-01" }, DAY, admin),
    ).rejects.toThrow();
    await changeLevel(db, { barberId: barber!.id, levelId: other.id, from: DAY }, DAY, admin);
    const [after] = await db.select().from(s.barbers).where(eq(s.barbers.id, barber!.id));
    expect(after?.levelId).toBe(other.id);
    const history = await db
      .select()
      .from(s.barberLevelHistory)
      .where(eq(s.barberLevelHistory.barberId, barber!.id));
    expect(history).toHaveLength(2);
  });
});

describe("members", () => {
  it("finds, edits and adjusts with a reason", async () => {
    const [bram] = await memberList(db, "bram");
    expect(bram?.memberNo).toBe("C00001");
    await expect(
      updateMember(db, { id: bram!.id, name: "Bram W.", memberNo: "C00002", status: "active" }, admin),
    ).rejects.toThrow("sudah dipakai");
    await updateMember(db, { id: bram!.id, name: "Bram W.", memberNo: "vip-01", status: "active" }, admin);
    await adjustMember(
      db,
      { id: bram!.id, kind: "balance", delta: 20_000, reason: "Kompensasi antre lama" },
      now,
      admin,
    );
    await expect(
      adjustMember(db, { id: bram!.id, kind: "points", delta: -999, reason: "salah input" }, now, admin),
    ).rejects.toThrow("minus");
    const detail = await memberDetail(db, bram!.id, now);
    expect(detail).toMatchObject({ memberNo: "VIP-01", name: "Bram W.", balance: 20_000 });
  });
});

describe("rules", () => {
  it("saves and reads back", async () => {
    const r = await rules(db);
    await saveRules(db, { ...r, graceMinutes: 7, birthday: { ...r.birthday, percent: 40 } }, admin);
    const after = await rules(db);
    expect(after.graceMinutes).toBe(7);
    expect(after.birthday.percent).toBe(40);
    await expect(saveRules(db, { ...r, graceMinutes: 99 }, admin)).rejects.toThrow("Waktu tunggu");
  });
});

describe("report", () => {
  it("counts sales, cash and commission for a counter bill", async () => {
    const [shift] = await db
      .select()
      .from(s.barberShifts)
      .where(and(eq(s.barberShifts.branchId, cashier.branchId!), eq(s.barberShifts.date, DAY)));
    const entry = await db.transaction((tx) =>
      enqueue(tx, {
        branchId: cashier.branchId!,
        barberId: shift!.barberId,
        date: DAY,
        source: "walkin",
        displayName: "Uji",
        estimatedMin: 30,
      }),
    );
    await db
      .update(s.queueEntries)
      .set({ status: "in_service", startedAt: now })
      .where(eq(s.queueEntries.id, entry.id));
    const [haircut] = await db.select().from(s.services).where(eq(s.services.priceType, "by_level"));
    await payAndFinish(
      db,
      { entryId: entry.id, items: [{ serviceId: haircut!.id }], edc: "edc_card" },
      cashier,
      now,
    );

    const report = await buildReport(db, DAY, DAY);
    expect(report.sales).toBeGreaterThan(0);
    expect(report.cash.total).toBeGreaterThanOrEqual(report.sales);
    expect(report.visits).toBeGreaterThanOrEqual(1);
    const c = report.commission.find((x) => x.barberId === shift!.barberId);
    expect(c?.commission).toBeGreaterThan(0);
    expect(c!.commission).toBeLessThan(c!.sales);
    expect(report.liabilities.balance).toBeGreaterThan(0);

    const today = await todayOverview(db, DAY);
    expect(today.find((b) => b.id === cashier.branchId)?.served).toBeGreaterThanOrEqual(1);
  });
});
