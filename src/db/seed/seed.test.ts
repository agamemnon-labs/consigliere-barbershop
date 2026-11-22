import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "../schema";
import { seed } from "./seed";

const client = new PGlite();
const db = drizzle(client, { schema: s, casing: "snake_case" });

beforeAll(async () => {
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  await seed(db, { staffPassword: "test-password", from: "2026-11-22", days: 7 });
}, 60_000);

describe("migrations + seed", () => {
  it("creates three branches and twelve barbers", async () => {
    expect(await db.$count(s.branches)).toBe(3);
    expect(await db.$count(s.barbers)).toBe(12);
  });

  it("prices haircuts by level, from the real pricelist", async () => {
    const levels = await db.select().from(s.barberLevels).orderBy(s.barberLevels.sort);
    expect(levels.map((l) => l.haircutPrice)).toEqual([80_000, 95_000, 110_000, 125_000]);
  });

  it("stores the haircut at 30 minutes and perm variants", async () => {
    const [haircut] = await db.select().from(s.services).where(eq(s.services.slug, "haircut"));
    expect(haircut?.durationMin).toBe(30);
    expect(haircut?.priceType).toBe("by_level");
    expect(await db.$count(s.serviceVariants)).toBe(4);
    expect(await db.$count(s.packageItems)).toBe(2);
  });

  it("gives every barber exactly one day off per week", async () => {
    const off = await db
      .select({ barberId: s.barberShifts.barberId, n: sql<number>`count(*)::int` })
      .from(s.barberShifts)
      .where(eq(s.barberShifts.status, "off"))
      .groupBy(s.barberShifts.barberId);
    expect(off).toHaveLength(12);
    expect(off.every((r) => r.n === 1)).toBe(true);
  });

  it("rejects an on-duty shift without a branch", async () => {
    const [barber] = await db.select().from(s.barbers).limit(1);
    await expect(
      db.insert(s.barberShifts).values({ barberId: barber!.id, date: "2027-01-01", status: "on" }),
    ).rejects.toThrow();
  });

  it("creates staff with a working credential and a home branch for cashiers", async () => {
    const cashiers = await db.select().from(s.users).where(eq(s.users.role, "cashier"));
    expect(cashiers).toHaveLength(3);
    expect(cashiers.every((c) => c.branchId)).toBe(true);
    const [owner] = await db.select().from(s.users).where(eq(s.users.email, "owner@consigliere.test"));
    const [account] = await db
      .select()
      .from(s.accounts)
      .where(and(eq(s.accounts.userId, owner!.id), eq(s.accounts.providerId, "credential")));
    expect(await verifyPassword({ hash: account!.password!, password: "test-password" })).toBe(true);
  });

  it("keeps the birthday discount to haircuts", async () => {
    const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "birthday_discount"));
    expect(row?.value).toMatchObject({ percent: 50, categories: ["haircut"] });
  });
});
