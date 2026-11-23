/**
 * Idempotent-ish demo seed: wipes the demo tables and inserts fresh data.
 * Works with any Drizzle Postgres driver (postgres.js in scripts, PGlite in tests).
 */
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { addDays, shopDate, weekday } from "../../domain/time.ts";
import * as s from "../schema.ts";
import {
  barberSeed,
  branchSeed,
  levelSeed,
  memberSeed,
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
  /** PIN for the demo members. Without it no members are seeded. */
  memberPin?: string;
};

export async function seed(db: AnyDb, options: SeedOptions) {
  const from = options.from ?? shopDate();
  const days = options.days ?? 14;

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table
      audit_log, outbox, topup_orders, point_ledger, balance_ledger, credit_ledger, transactions,
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

    if (options.memberPin) {
      const pinHash = await hashPassword(options.memberPin);
      const packages = (await tx.select().from(s.topupPackages)).sort((a, b) => a.pay - b.pay);
      for (const [i, m] of memberSeed.entries()) {
        const dob = m.birthdayNow ? `${m.dob.slice(0, 4)}${from.slice(4, 7)}-${m.dob.slice(8)}` : m.dob;
        const [customer] = await tx.insert(s.customers).values({ name: m.name, phone: m.phone }).returning();
        const [user] = await tx
          .insert(s.users)
          .values({
            name: m.name,
            email: `${m.phone}@member.consigliere.invalid`,
            phoneNumber: m.phone,
            phoneNumberVerified: true,
            role: "member",
          })
          .returning();
        if (!customer || !user) throw new Error(`Member ${m.name} was not inserted`);
        await tx
          .insert(s.accounts)
          .values({ userId: user.id, accountId: user.id, providerId: "credential", password: pinHash });
        const [member] = await tx
          .insert(s.members)
          .values({
            customerId: customer.id,
            userId: user.id,
            dob,
            memberNo: `C${String(i + 1).padStart(5, "0")}`,
          })
          .returning();
        if (!member) throw new Error(`Member ${m.name} was not inserted`);
        await tx.insert(s.pointLedger).values({ memberId: member.id, delta: m.points, reason: "earn" });
        const pkg = m.topup ? packages[m.topup - 1] : undefined;
        if (pkg) {
          await tx.insert(s.balanceLedger).values([
            { memberId: member.id, delta: pkg.pay, reason: "topup" },
            { memberId: member.id, delta: pkg.get - pkg.pay, reason: "bonus" },
          ]);
        }
      }
    }

    if (options.demoQueueAt) {
      await seedDemoSales(tx, from, branchRows, barberRows, levelRows);
      await seedDemoQueue(tx, from, options.demoQueueAt, shifts, branchRows);
      await payDoneVisits(tx, from);
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

/** Small deterministic generator so the demo history is the same on every reset. */
function lcg(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1_664_525) + 1_013_904_223) >>> 0;
    return x / 2 ** 32;
  };
}

/**
 * Four weeks of finished, paid visits before the first seeded day, so the back
 * office report and commission have something real to show. Each barber works
 * at home on their working days; a few add a second service.
 */
async function seedDemoSales(
  tx: Tx,
  from: string,
  branches: { id: string; slug: string }[],
  barbers: { id: string; slug: string }[],
  levels: { id: string; slug: string; haircutPrice: number }[],
) {
  const services = await tx
    .select({ id: s.services.id, slug: s.services.slug, name: s.services.name, price: s.services.price })
    .from(s.services);
  const haircut = services.find((x) => x.slug === "haircut");
  const extras = services.filter((x) => x.price !== null && x.slug !== "haircut");
  if (!haircut) return;
  const rand = lcg(20_261_123);
  const methods = ["edc_qris", "edc_qris", "edc_card"] as const;
  for (let d = 28; d >= 1; d--) {
    const date = addDays(from, -d);
    const entries: (typeof s.queueEntries.$inferInsert & { id: string })[] = [];
    const txs: (typeof s.transactions.$inferInsert)[] = [];
    const tickets = new Map<string, number>();
    for (const b of barberSeed) {
      if (weekday(date) === b.offDay) continue;
      const branch = branches.find((x) => x.slug === b.home);
      const barber = barbers.find((x) => x.slug === b.slug);
      const level = levels.find((x) => x.slug === b.level);
      if (!branch || !barber || !level) continue;
      const visits = 3 + Math.floor(rand() * 5);
      for (let v = 0; v < visits; v++) {
        const ticketNo = (tickets.get(branch.id) ?? 0) + 1;
        tickets.set(branch.id, ticketNo);
        const minute = 10 * 60 + Math.floor(rand() * 10.5 * 60);
        const hh = String(Math.floor(minute / 60)).padStart(2, "0");
        const mm = String(minute % 60).padStart(2, "0");
        const at = new Date(`${date}T${hh}:${mm}:00+08:00`);
        const items = [{ serviceId: haircut.id, name: haircut.name, price: level.haircutPrice, discount: 0 }];
        const extra = rand() < 0.25 ? extras[Math.floor(rand() * extras.length)] : undefined;
        if (extra?.price)
          items.push({ serviceId: extra.id, name: extra.name, price: extra.price, discount: 0 });
        const total = items.reduce((sum, i) => sum + i.price, 0);
        const id = crypto.randomUUID();
        entries.push({
          id,
          branchId: branch.id,
          barberId: barber.id,
          date,
          position: v + 1,
          ticketNo,
          source: rand() < 0.3 ? "online" : "walkin",
          status: "done",
          estimatedMin: 30,
          startedAt: new Date(at.getTime() - 30 * 60_000),
          finishedAt: at,
        });
        txs.push({
          branchId: branch.id,
          barberId: barber.id,
          queueEntryId: id,
          items,
          subtotal: total,
          total,
          method: methods[Math.floor(rand() * methods.length)] ?? "edc_qris",
          createdAt: at,
        });
      }
    }
    if (entries.length) await tx.insert(s.queueEntries).values(entries);
    if (txs.length) await tx.insert(s.transactions).values(txs);
  }
}

/** Today's already-finished demo visits get their counter bill, so takings match the board. */
async function payDoneVisits(tx: Tx, date: string) {
  const [haircut] = await tx.select().from(s.services).where(eq(s.services.slug, "haircut"));
  if (!haircut) return;
  const done = await tx
    .select({
      id: s.queueEntries.id,
      branchId: s.queueEntries.branchId,
      barberId: s.queueEntries.barberId,
      finishedAt: s.queueEntries.finishedAt,
      price: s.barberLevels.haircutPrice,
    })
    .from(s.queueEntries)
    .innerJoin(s.barbers, eq(s.barbers.id, s.queueEntries.barberId))
    .innerJoin(s.barberLevels, eq(s.barberLevels.id, s.barbers.levelId))
    .where(and(eq(s.queueEntries.date, date), eq(s.queueEntries.status, "done")));
  if (done.length === 0) return;
  await tx.insert(s.transactions).values(
    done.map((e) => ({
      branchId: e.branchId,
      barberId: e.barberId,
      queueEntryId: e.id,
      items: [{ serviceId: haircut.id, name: haircut.name, price: e.price, discount: 0 }],
      subtotal: e.price,
      total: e.price,
      method: "edc_qris" as const,
      ...(e.finishedAt ? { createdAt: e.finishedAt } : {}),
    })),
  );
}
