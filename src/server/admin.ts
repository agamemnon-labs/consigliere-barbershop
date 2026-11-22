import "server-only";
import { and, asc, count, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { creditAvailable } from "@/domain/checkout";
import { type CashLine, commissions, groupBy, type SaleLine, sum } from "@/domain/report";
import { addDays, shopDate } from "@/domain/time";
import { takingsBetween } from "@/server/checkout";
import { numberSetting } from "@/server/enqueue";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const dayStart = (date: string) => new Date(`${date}T00:00:00+08:00`);

/** The owner's first screen: each branch today, at a glance. */
export async function todayOverview(db: Database, date: string) {
  const [branches, served, waiting, duty] = await Promise.all([
    db.select().from(s.branches).orderBy(asc(s.branches.name)),
    db
      .select({ branchId: s.queueEntries.branchId, n: count() })
      .from(s.queueEntries)
      .where(and(eq(s.queueEntries.date, date), eq(s.queueEntries.status, "done")))
      .groupBy(s.queueEntries.branchId),
    db
      .select({ branchId: s.queueEntries.branchId, n: count() })
      .from(s.queueEntries)
      .where(
        and(
          eq(s.queueEntries.date, date),
          inArray(s.queueEntries.status, ["waiting", "called", "in_service"]),
        ),
      )
      .groupBy(s.queueEntries.branchId),
    db
      .select({ branchId: s.barberShifts.branchId, n: count() })
      .from(s.barberShifts)
      .where(and(eq(s.barberShifts.date, date), eq(s.barberShifts.status, "on")))
      .groupBy(s.barberShifts.branchId),
  ]);
  const takings = await Promise.all(branches.map((b) => takingsBetween(db, b.id, date, date)));
  const n = (rows: { branchId: string | null; n: number }[], id: string) =>
    rows.find((r) => r.branchId === id)?.n ?? 0;
  return branches.map((b, i) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    takings: takings[i]?.total ?? 0,
    served: n(served, b.id),
    inLine: n(waiting, b.id),
    barbers: n(duty, b.id),
  }));
}

/** Every service sold in a date range: counter bills by their time, online bookings by when they were paid. */
export async function salesBetween(db: Database, from: string, to: string): Promise<SaleLine[]> {
  const start = dayStart(from);
  const end = dayStart(addDays(to, 1));
  const [txs, bookings, services] = await Promise.all([
    db
      .select({
        createdAt: s.transactions.createdAt,
        branchId: s.transactions.branchId,
        barberId: s.transactions.barberId,
        items: s.transactions.items,
      })
      .from(s.transactions)
      .where(and(gte(s.transactions.createdAt, start), lt(s.transactions.createdAt, end))),
    db
      .select({
        paidAt: s.bookings.paidAt,
        branchId: s.bookings.branchId,
        barberId: s.bookings.barberId,
        services: s.bookings.services,
      })
      .from(s.bookings)
      .where(and(eq(s.bookings.status, "paid"), gte(s.bookings.paidAt, start), lt(s.bookings.paidAt, end))),
    db.select({ id: s.services.id, category: s.services.category }).from(s.services),
  ]);
  const category = new Map(services.map((x) => [x.id, x.category as string]));
  const lines: SaleLine[] = [];
  for (const t of txs) {
    for (const i of t.items) {
      // Membership fees and top-ups are money in, not services sold.
      if (!isUuid(i.serviceId)) continue;
      lines.push({
        date: shopDate(t.createdAt),
        branchId: t.branchId,
        barberId: t.barberId,
        serviceId: i.serviceId,
        name: i.name,
        category: category.get(i.serviceId) ?? "",
        amount: i.price - i.discount,
        source: "counter",
      });
    }
  }
  for (const b of bookings) {
    for (const i of b.services) {
      lines.push({
        date: shopDate(b.paidAt ?? start),
        branchId: b.branchId,
        barberId: b.barberId,
        serviceId: i.serviceId,
        name: i.name,
        category: category.get(i.serviceId) ?? "",
        amount: i.price,
        source: "online",
      });
    }
  }
  return lines;
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

/** The back-office report for a date range (inclusive, WITA). */
export async function buildReport(db: Database, from: string, to: string) {
  const start = dayStart(from);
  const end = dayStart(addDays(to, 1));
  const [lines, cash, branches, barbers, levels, history, otherBps, visits, other, balance, bonus, credits] =
    await Promise.all([
      salesBetween(db, from, to),
      takingsBetween(db, null, from, to),
      db.select({ id: s.branches.id, name: s.branches.name }).from(s.branches),
      db.select({ id: s.barbers.id, name: s.barbers.name }).from(s.barbers),
      db.select({ id: s.barberLevels.id, bps: s.barberLevels.commissionBps }).from(s.barberLevels),
      db.select().from(s.barberLevelHistory),
      numberSetting(db, "default_commission_bps", 4_000),
      db
        .select({ n: count() })
        .from(s.queueEntries)
        .where(
          and(
            eq(s.queueEntries.status, "done"),
            gte(s.queueEntries.date, from),
            lte(s.queueEntries.date, to),
          ),
        ),
      db
        .select({ items: s.transactions.items })
        .from(s.transactions)
        .where(and(gte(s.transactions.createdAt, start), lt(s.transactions.createdAt, end))),
      db
        .select({ total: sql<number>`coalesce(sum(${s.balanceLedger.delta}), 0)::int` })
        .from(s.balanceLedger),
      db
        .select({ total: sql<number>`coalesce(sum(${s.balanceLedger.delta}), 0)::int` })
        .from(s.balanceLedger)
        .where(
          and(
            eq(s.balanceLedger.reason, "bonus"),
            gte(s.balanceLedger.createdAt, start),
            lt(s.balanceLedger.createdAt, end),
          ),
        ),
      db.select().from(s.creditLedger),
    ]);

  const name = (rows: { id: string; name: string }[], id: string | null) =>
    rows.find((r) => r.id === id)?.name ?? "Tanpa barber";
  let fees = 0;
  let topups = 0;
  for (const t of other) {
    for (const i of t.items) {
      if (i.serviceId === "membership") fees += i.price;
      if (i.serviceId === "topup") topups += i.price;
    }
  }
  const byPhone = Map.groupBy(credits, (c) => c.phone);
  const now = new Date();
  const openCredit = [...byPhone.values()].reduce((s2, rows) => s2 + creditAvailable(rows, now), 0);

  const commission = commissions(lines, history, {
    haircutBps: Object.fromEntries(levels.map((l) => [l.id, l.bps])),
    otherBps,
  }).map((c) => ({ ...c, name: name(barbers, c.barberId) }));

  const cashLines: CashLine[] = Object.entries(cash.byMethod).map(([method, amount]) => ({
    date: from,
    branchId: "",
    method,
    amount: amount ?? 0,
  }));

  return {
    from,
    to,
    sales: sum(lines),
    visits: visits[0]?.n ?? 0,
    cash: { total: cash.total, byMethod: groupBy(cashLines, (l) => l.method), prepaid: cash.prepaid },
    fees,
    topups,
    liabilities: { balance: balance[0]?.total ?? 0, bonusGiven: bonus[0]?.total ?? 0, credit: openCredit },
    byBranch: groupBy(lines, (l) => l.branchId).map((t) => ({ ...t, name: name(branches, t.key) })),
    byService: groupBy(lines, (l) => l.name),
    commission,
    lines: lines.map((l) => ({
      ...l,
      branch: name(branches, l.branchId),
      barber: l.barberId ? name(barbers, l.barberId) : "",
    })),
  };
}
