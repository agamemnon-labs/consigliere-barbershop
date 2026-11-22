import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb, schema as s } from "@/db";
import { addDays, shopDate } from "@/domain/time";

/*
 * Read side of the public site. Everything here is cached and tagged so admin
 * edits (phase 7) can refresh it with revalidateTag.
 */

/** The shop's date. Cached for a minute so pages can prerender and still roll over at midnight WITA. */
export async function getToday(): Promise<string> {
  "use cache";
  cacheLife("minutes");
  return shopDate();
}

export async function getLevels() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const db = await getDb();
  return db.select().from(s.barberLevels).orderBy(asc(s.barberLevels.sort));
}

export type Level = Awaited<ReturnType<typeof getLevels>>[number];

export async function getServices() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const db = await getDb();
  const [services, variants] = await Promise.all([
    db.select().from(s.services).where(eq(s.services.isActive, true)).orderBy(asc(s.services.sort)),
    db.select().from(s.serviceVariants).orderBy(asc(s.serviceVariants.sort)),
  ]);
  return services.map((svc) => ({ ...svc, variants: variants.filter((v) => v.serviceId === svc.id) }));
}

export type Service = Awaited<ReturnType<typeof getServices>>[number];

export async function getBranches() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const db = await getDb();
  return db.select().from(s.branches).where(eq(s.branches.isActive, true)).orderBy(asc(s.branches.name));
}

export type Branch = Awaited<ReturnType<typeof getBranches>>[number];

export async function getBarbers() {
  "use cache";
  cacheTag("catalog");
  cacheLife("hours");
  const db = await getDb();
  const rows = await db
    .select({ barber: s.barbers, level: s.barberLevels })
    .from(s.barbers)
    .innerJoin(s.barberLevels, eq(s.barbers.levelId, s.barberLevels.id))
    .where(eq(s.barbers.isActive, true));
  return rows
    .map(({ barber, level }) => ({ ...barber, level }))
    .sort((a, b) => b.level.sort - a.level.sort || a.name.localeCompare(b.name));
}

export type Barber = Awaited<ReturnType<typeof getBarbers>>[number];

/** Rotation and closures for `days` days from `from`. */
export async function getRotation(from: string, days = 7) {
  "use cache";
  cacheTag("rotation");
  cacheLife("minutes");
  const db = await getDb();
  const to = addDays(from, days - 1);
  const [shifts, closures] = await Promise.all([
    db
      .select({
        barberId: s.barberShifts.barberId,
        date: s.barberShifts.date,
        status: s.barberShifts.status,
        branchId: s.barberShifts.branchId,
      })
      .from(s.barberShifts)
      .where(and(gte(s.barberShifts.date, from), lte(s.barberShifts.date, to))),
    db
      .select({ branchId: s.closures.branchId, date: s.closures.date, reason: s.closures.reason })
      .from(s.closures)
      .where(and(gte(s.closures.date, from), lte(s.closures.date, to))),
  ]);
  return { shifts, closures };
}
