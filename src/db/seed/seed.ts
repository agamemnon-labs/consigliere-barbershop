/**
 * Idempotent-ish demo seed: wipes the demo tables and inserts fresh data.
 * Works with any Drizzle Postgres driver (postgres.js in scripts, PGlite in tests).
 */
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { addDays, shopDate, weekday } from "../../domain/time.ts";
import * as s from "../schema.ts";
import {
  barberSeed,
  branchSeed,
  levelSeed,
  serviceSeed,
  settingsSeed,
  staffSeed,
  topupSeed,
} from "./data.ts";

// biome-ignore lint/suspicious/noExplicitAny: accepts any driver's schema-typed database
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

export type SeedOptions = {
  staffPassword: string;
  /** First day of the generated rotation, YYYY-MM-DD (WITA). Defaults to today. */
  from?: string;
  days?: number;
  /** Put a believable queue on today's first day so the screens aren't empty. Pass the current time. */
  demoQueueAt?: Date;
};

export async function seed(db: AnyDb, options: SeedOptions) {
  const from = options.from ?? shopDate();
  const days = options.days ?? 14;

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table
      audit_log, outbox, point_ledger, balance_ledger, credit_ledger, transactions,
      queue_entries, bookings, members, customers, display_devices,
      sessions, accounts, verifications, rate_limits, users,
      package_items, service_variants, services, barber_shifts, barber_level_history,
      barbers, barber_levels, closures, branches, topup_packages, settings
      restart identity cascade`);

    const branchRows = await tx
      .insert(s.branches)
      .values([...branchSeed])
      .returning();
    const branchId = bySlug(branchRows);

    const levelRows = await tx
      .insert(s.barberLevels)
      .values([...levelSeed])
      .returning();
    const levelId = bySlug(levelRows);

    const barberRows = await tx
      .insert(s.barbers)
      .values(
        barberSeed.map((b) => ({
          slug: b.slug,
          name: b.name,
          bio: b.bio,
          levelId: levelId(b.level),
        })),
      )
      .returning();
    const barberId = bySlug(barberRows);

    await tx.insert(s.barberLevelHistory).values(
      barberSeed.map((b) => ({
        barberId: barberId(b.slug),
        levelId: levelId(b.level),
        effectiveFrom: "2026-01-01",
      })),
    );

    const shifts = barberSeed.flatMap((b) =>
      Array.from({ length: days }, (_, i) => {
        const date = addDays(from, i);
        const off = weekday(date) === b.offDay;
        return {
          barberId: barberId(b.slug),
          date,
          status: off ? ("off" as const) : ("on" as const),
          branchId: off ? null : branchId(rotate(b.home, date, b.slug)),
          start: off ? null : "10:00",
          end: off ? null : "21:00",
        };
      }),
    );
    await tx.insert(s.barberShifts).values(shifts);

    for (const [sort, svc] of serviceSeed.entries()) {
      const [row] = await tx
        .insert(s.services)
        .values({
          slug: svc.slug,
          category: svc.category,
          name: svc.name,
          description: svc.description,
          durationMin: svc.durationMin,
          priceType: svc.priceType,
          price: "price" in svc ? svc.price : null,
          priceFrom: "priceFrom" in svc ? svc.priceFrom : null,
          sort,
        })
        .returning();
      if (!row) throw new Error(`Service ${svc.slug} was not inserted`);
      if ("variants" in svc) {
        await tx
          .insert(s.serviceVariants)
          .values(svc.variants.map((v, i) => ({ ...v, serviceId: row.id, sort: i })));
      }
    }
    const serviceRows = await tx.select({ id: s.services.id, slug: s.services.slug }).from(s.services);
    const serviceId = bySlug(serviceRows);
    for (const svc of serviceSeed) {
      if ("items" in svc) {
        await tx.insert(s.packageItems).values(
          svc.items.map((item) => ({
            packageId: serviceId(svc.slug),
            serviceId: serviceId(item),
          })),
        );
      }
    }

    await tx.insert(s.topupPackages).values([...topupSeed]);
    await tx.insert(s.settings).values(Object.entries(settingsSeed).map(([key, value]) => ({ key, value })));

    const passwordHash = await hashPassword(options.staffPassword);
    for (const staff of staffSeed) {
      const [user] = await tx
        .insert(s.users)
        .values({
          email: staff.email,
          name: staff.name,
          role: staff.role,
          emailVerified: true,
          branchId: staff.branch ? branchId(staff.branch) : null,
        })
        .returning();
      if (!user) throw new Error(`Staff ${staff.email} was not inserted`);
      await tx.insert(s.accounts).values({
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      });
    }

    if (options.demoQueueAt) {
      await seedDemoQueue(tx, from, options.demoQueueAt, shifts, branchRows);
    }
  });
}

function bySlug<T extends { id: string; slug: string }>(rows: T[]) {
  const map = new Map(rows.map((r) => [r.slug, r.id]));
  return (slug: string) => {
    const id = map.get(slug);
    if (!id) throw new Error(`Unknown seed slug: ${slug}`);
    return id;
  };
}

/** Barbers rotate: one day in seven they cover the next branch along. */
function rotate(home: string, date: string, slug: string): string {
  const order = branchSeed.map((b) => b.slug);
  const dayIndex = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
  const covers = (dayIndex + slug.length) % 7 === 0;
  if (!covers) return home;
  const next = order[(order.indexOf(home as (typeof order)[number]) + 1) % order.length];
  return next ?? home;
}

type Tx = Parameters<Parameters<AnyDb["transaction"]>[0]>[0];

/** A few customers per branch: someone in the chair, someone called, a short line. */
async function seedDemoQueue(
  tx: Tx,
  date: string,
  now: Date,
  shifts: { barberId: string; date: string; status: "on" | "off"; branchId: string | null }[],
  branches: { id: string }[],
) {
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);
  const names = ["Bram", "Rizal", "Andi", "Yoga", "Fajar", "Dimas", "Reza", "Hendra", "Bayu", "Gilang"];
  let n = 0;
  for (const branch of branches) {
    const duty = shifts.filter((x) => x.date === date && x.status === "on" && x.branchId === branch.id);
    let ticket = 10;
    const rows: (typeof s.queueEntries.$inferInsert)[] = [];
    duty.slice(0, 3).forEach((shift, i) => {
      const base = { branchId: branch.id, barberId: shift.barberId, date, estimatedMin: 30 };
      const name = () => names[n++ % names.length] ?? null;
      rows.push({
        ...base,
        position: 1,
        ticketNo: ticket++,
        displayName: name(),
        source: "walkin",
        status: "done",
        startedAt: ago(70),
        finishedAt: ago(40),
      });
      if (i === 0) {
        rows.push({
          ...base,
          position: 2,
          ticketNo: ticket++,
          displayName: name(),
          source: "walkin",
          status: "in_service",
          calledAt: ago(14),
          startedAt: ago(12),
        });
        rows.push({
          ...base,
          position: 3,
          ticketNo: ticket++,
          displayName: name(),
          source: "online",
          status: "waiting",
        });
        rows.push({
          ...base,
          position: 4,
          ticketNo: ticket++,
          displayName: null,
          source: "walkin",
          status: "waiting",
        });
      } else if (i === 1) {
        rows.push({
          ...base,
          position: 2,
          ticketNo: ticket++,
          displayName: name(),
          source: "online",
          status: "called",
          calledAt: ago(2),
          graceUntil: new Date(now.getTime() + 3 * 60_000),
        });
        rows.push({
          ...base,
          position: 3,
          ticketNo: ticket++,
          displayName: name(),
          source: "walkin",
          status: "waiting",
        });
      } else {
        rows.push({
          ...base,
          position: 2,
          ticketNo: ticket++,
          displayName: name(),
          source: "walkin",
          status: "waiting",
        });
      }
    });
    if (rows.length) await tx.insert(s.queueEntries).values(rows);
  }
}
