import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { type BillItem, bill, CheckoutError, creditAvailable, type Method } from "@/domain/checkout";
import { applyBirthday, applyVoucher, pointsEarned, redeemableUnits } from "@/domain/membership";
import * as q from "@/domain/queue";
import { addDays } from "@/domain/time";
import type { Tx } from "@/server/enqueue";
import { birthdayRule, checkPin, findMemberById, pointsRule } from "@/server/membership";

export type PayInput = {
  entryId: string;
  items: { serviceId: string; variantId?: string; price?: number }[];
  edc: "edc_card" | "edc_qris";
  /** WhatsApp number to look up credit and link the customer. Optional. */
  phone?: string;
  useCredit?: number;
  /** A member scanned at the counter, and what they chose to use. */
  member?: { id: string; birthday?: boolean; redeemUnits?: number; balance?: number; pin?: string };
};

export type Cashier = { id: string; role: string; branchId: string | null };

/**
 * "Selesai & bayar": prices the services server-side, takes credit if asked,
 * records the transaction and finishes the queue entry, all in one go.
 */
export async function payAndFinish(
  db: Database,
  input: PayInput,
  cashier: Cashier,
  now: Date,
): Promise<string> {
  // Checked before the transaction so a wrong PIN still counts toward the lock.
  if (input.member?.balance) await checkPin(db, input.member.id, input.member.pin ?? "", now);

  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(s.queueEntries).where(eq(s.queueEntries.id, input.entryId));
    if (!entry) throw new CheckoutError("Antrean tidak ditemukan.");
    if (cashier.role === "cashier" && cashier.branchId !== entry.branchId) {
      throw new CheckoutError("Antrean ini milik cabang lain.");
    }
    const [paid] = await tx
      .select({ id: s.transactions.id })
      .from(s.transactions)
      .where(eq(s.transactions.queueEntryId, entry.id));
    if (paid) throw new CheckoutError("Antrean ini sudah dibayar.");

    const line = await tx
      .select()
      .from(s.queueEntries)
      .where(and(eq(s.queueEntries.barberId, entry.barberId), eq(s.queueEntries.date, entry.date)))
      .for("update");
    const patches = q.finish(line, entry.id, now);

    let items = await priceAtCounter(tx, entry.barberId, input.items);

    let customerId = entry.customerId;
    let member: Awaited<ReturnType<typeof findMemberById>> = null;
    let redeemed = 0;
    let earned = 0;
    const rule = await pointsRule(tx);
    if (input.member) {
      member = await findMemberById(tx, input.member.id, now);
      if (member?.status !== "active") throw new CheckoutError("Member tidak aktif.");
      customerId = member.customerId;
      const birthday = await birthdayRule(tx);
      const usesBirthday = Boolean(input.member.birthday);
      if (usesBirthday) {
        if (!member.birthday) throw new CheckoutError("Bukan bulan ulang tahun member ini.");
        items = applyBirthday(items, birthday);
      }
      const units = Math.floor(input.member.redeemUnits ?? 0);
      if (units > 0) {
        if (usesBirthday && !birthday.stacksWithPoints) {
          throw new CheckoutError("Diskon ulang tahun tidak bisa digabung dengan tukar poin.");
        }
        const left = items.reduce((sum, i) => sum + i.price - i.discount, 0);
        if (units > redeemableUnits(member.points, left, rule)) throw new CheckoutError("Poin tidak cukup.");
        items = applyVoucher(items, units * rule.redeemValue);
        redeemed = units * rule.redeemPoints;
      }
    }
    let available = 0;
    const phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone) throw new CheckoutError("Nomor WhatsApp belum benar.");
    if (phone) {
      const rows = await tx.select().from(s.creditLedger).where(eq(s.creditLedger.phone, phone));
      available = creditAvailable(rows, now);
      const [customer] = await tx.select().from(s.customers).where(eq(s.customers.phone, phone));
      customerId ??= customer?.id ?? null;
    }
    const totals = bill(items, input.edc, {
      credit: Math.min(input.useCredit ?? 0, available),
      balance: member ? Math.min(input.member?.balance ?? 0, member.balance) : 0,
    });
    earned = member ? pointsEarned(totals.total, rule) : 0;

    const [row] = await tx
      .insert(s.transactions)
      .values({
        branchId: entry.branchId,
        barberId: entry.barberId,
        customerId,
        memberId: member?.id ?? null,
        queueEntryId: entry.id,
        items: items.map(({ category: _, ...item }) => item),
        subtotal: totals.subtotal,
        discounts: totals.discounts,
        total: totals.total,
        method: totals.method,
        cashierId: cashier.id,
        createdAt: now,
      })
      .returning({ id: s.transactions.id });
    if (!row) throw new Error("Transaction was not saved");

    if (phone && totals.credit > 0) {
      await tx.insert(s.creditLedger).values({
        phone,
        delta: -totals.credit,
        reason: "spend",
        transactionId: row.id,
        createdAt: now,
      });
    }
    if (member && totals.balance > 0) {
      await tx.insert(s.balanceLedger).values({
        memberId: member.id,
        delta: -totals.balance,
        reason: "spend",
        transactionId: row.id,
        createdAt: now,
      });
    }
    if (member && redeemed > 0) {
      await tx.insert(s.pointLedger).values({
        memberId: member.id,
        delta: -redeemed,
        reason: "redeem",
        transactionId: row.id,
        createdAt: now,
      });
    }
    if (member && earned > 0) {
      await tx.insert(s.pointLedger).values({
        memberId: member.id,
        delta: earned,
        reason: "earn",
        transactionId: row.id,
        createdAt: now,
      });
    }
    for (const { id, ...patch } of patches) {
      await tx.update(s.queueEntries).set(patch).where(eq(s.queueEntries.id, id));
    }
    await tx.insert(s.auditLog).values({
      actorId: cashier.id,
      action: "transaction.create",
      entity: "transactions",
      after: {
        id: row.id,
        total: totals.total,
        credit: totals.credit,
        due: totals.due,
        method: totals.method,
      },
    });
    return row.id;
  });
}

/** Prices what the cashier picked. Haircut by the barber's level; "from" services take the typed price. */
type PricedItem = BillItem & { category: string };

async function priceAtCounter(tx: Tx, barberId: string, picks: PayInput["items"]): Promise<PricedItem[]> {
  if (picks.length === 0) throw new CheckoutError("Tagihan masih kosong.");
  const ids = [...new Set(picks.map((p) => p.serviceId))];
  const [services, variants, [barber]] = await Promise.all([
    tx.select().from(s.services).where(inArray(s.services.id, ids)),
    tx.select().from(s.serviceVariants).where(inArray(s.serviceVariants.serviceId, ids)),
    tx
      .select({ haircutPrice: s.barberLevels.haircutPrice })
      .from(s.barbers)
      .innerJoin(s.barberLevels, eq(s.barbers.levelId, s.barberLevels.id))
      .where(eq(s.barbers.id, barberId)),
  ]);
  return picks.map((pick): PricedItem => ({ ...priceOne(svc(pick), pick), category: svc(pick).category }));

  function svc(pick: PayInput["items"][number]) {
    const found = services.find((x) => x.id === pick.serviceId);
    if (!found) throw new CheckoutError("Layanan tidak ditemukan.");
    return found;
  }

  function priceOne(svc: (typeof services)[number], pick: PayInput["items"][number]): BillItem {
    switch (svc.priceType) {
      case "by_level":
        return { serviceId: svc.id, name: svc.name, price: barber?.haircutPrice ?? 0, discount: 0 };
      case "fixed":
        return { serviceId: svc.id, name: svc.name, price: svc.price ?? 0, discount: 0 };
      case "variant": {
        const v = variants.find((x) => x.id === pick.variantId && x.serviceId === svc.id);
        if (!v) throw new CheckoutError(`Pilih ukuran untuk ${svc.name}.`);
        return { serviceId: svc.id, name: `${svc.name}, ${v.name}`, price: v.price, discount: 0 };
      }
      case "from": {
        const price = Math.round(pick.price ?? 0);
        if (price < (svc.priceFrom ?? 0)) {
          throw new CheckoutError(`Harga ${svc.name} minimal ${svc.priceFrom?.toLocaleString("id-ID")}.`);
        }
        return { serviceId: svc.id, name: svc.name, price, discount: 0 };
      }
    }
  }
}

/** Credit a phone number can use at the counter right now. */
export async function creditFor(db: Database, phone: string, now: Date): Promise<number> {
  const rows = await db.select().from(s.creditLedger).where(eq(s.creditLedger.phone, phone));
  return creditAvailable(rows, now);
}

/** Everything a printed receipt needs. */
export async function getReceipt(db: Database, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ tx: s.transactions, branch: s.branches, barber: s.barbers.name, cashier: s.users.name })
    .from(s.transactions)
    .innerJoin(s.branches, eq(s.transactions.branchId, s.branches.id))
    .leftJoin(s.barbers, eq(s.transactions.barberId, s.barbers.id))
    .leftJoin(s.users, eq(s.transactions.cashierId, s.users.id))
    .where(eq(s.transactions.id, id));
  if (!row) return null;
  const [credit] = await db
    .select({ spent: sql<number>`coalesce(sum(-${s.creditLedger.delta}), 0)::int` })
    .from(s.creditLedger)
    .where(eq(s.creditLedger.transactionId, row.tx.id));
  const [balance, points, member] = await Promise.all([
    db
      .select({ delta: s.balanceLedger.delta })
      .from(s.balanceLedger)
      .where(eq(s.balanceLedger.transactionId, row.tx.id)),
    db
      .select({ delta: s.pointLedger.delta, reason: s.pointLedger.reason })
      .from(s.pointLedger)
      .where(eq(s.pointLedger.transactionId, row.tx.id)),
    row.tx.memberId
      ? db
          .select({ memberNo: s.members.memberNo, name: s.customers.name })
          .from(s.members)
          .innerJoin(s.customers, eq(s.members.customerId, s.customers.id))
          .where(eq(s.members.id, row.tx.memberId))
      : Promise.resolve([]),
  ]);
  const spentFromBalance = -balance.filter((b) => b.delta < 0).reduce((sum, b) => sum + b.delta, 0);
  return {
    ...row,
    creditUsed: credit?.spent ?? 0,
    // A top-up's own rows are positive; only spending shows as "paid with balance".
    balanceUsed: spentFromBalance,
    pointsEarned: points.filter((p) => p.reason === "earn").reduce((sum, p) => sum + p.delta, 0),
    pointsRedeemed: -points.filter((p) => p.reason === "redeem").reduce((sum, p) => sum + p.delta, 0),
    member: member[0] ?? null,
  };
}

export type Takings = {
  count: number;
  /** New money today: the EDC part of counter bills plus online QRIS. */
  total: number;
  byMethod: Partial<Record<Method | string, number>>;
  /** Paid from money that came in earlier (member balance, credit); not in `total`. */
  prepaid: { balance: number; credit: number };
};

/** What a branch took today (WITA), by payment method. Online QRIS counts on the day it was paid. */
export async function todayTakings(db: Database, branchId: string, date: string): Promise<Takings> {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(`${addDays(date, 1)}T00:00:00+08:00`);
  const counter = await db
    .select({ id: s.transactions.id, method: s.transactions.method, total: s.transactions.total })
    .from(s.transactions)
    .where(
      and(
        eq(s.transactions.branchId, branchId),
        gte(s.transactions.createdAt, start),
        lt(s.transactions.createdAt, end),
      ),
    );
  const online = await db
    .select({ amount: s.bookings.amount })
    .from(s.bookings)
    .where(
      and(
        eq(s.bookings.branchId, branchId),
        eq(s.bookings.status, "paid"),
        gte(s.bookings.paidAt, start),
        lt(s.bookings.paidAt, end),
      ),
    );
  const ids = counter.map((t) => t.id);
  const [balanceRows, creditRows] = ids.length
    ? await Promise.all([
        db
          .select({ transactionId: s.balanceLedger.transactionId, delta: s.balanceLedger.delta })
          .from(s.balanceLedger)
          .where(and(inArray(s.balanceLedger.transactionId, ids), lt(s.balanceLedger.delta, 0))),
        db
          .select({ transactionId: s.creditLedger.transactionId, delta: s.creditLedger.delta })
          .from(s.creditLedger)
          .where(and(inArray(s.creditLedger.transactionId, ids), lt(s.creditLedger.delta, 0))),
      ])
    : [[], []];
  const spent = (rows: { transactionId: string | null; delta: number }[], id: string) =>
    rows.filter((r) => r.transactionId === id).reduce((sum, r) => sum - r.delta, 0);
  const byMethod: Takings["byMethod"] = {};
  const prepaid = { balance: 0, credit: 0 };
  for (const t of counter) {
    const balance = spent(balanceRows, t.id);
    const credit = spent(creditRows, t.id);
    prepaid.balance += balance;
    prepaid.credit += credit;
    const edc = t.total - balance - credit;
    if (edc > 0) byMethod[t.method] = (byMethod[t.method] ?? 0) + edc;
  }
  if (online.length) byMethod.online_qris = online.reduce((sum, b) => sum + b.amount, 0);
  const total = Object.values(byMethod).reduce((sum: number, v) => sum + (v ?? 0), 0);
  return { count: counter.length + online.length, total, byMethod, prepaid };
}

/** Services the cashier can put on a bill, read fresh (ids must match the live database). */
export async function counterCatalog(db: Database) {
  const [services, variants] = await Promise.all([
    db.select().from(s.services).where(eq(s.services.isActive, true)),
    db.select().from(s.serviceVariants),
  ]);
  return services
    .sort((a, b) => a.sort - b.sort)
    .map((svc) => ({
      id: svc.id,
      slug: svc.slug,
      name: svc.name,
      priceType: svc.priceType,
      price: svc.price,
      priceFrom: svc.priceFrom,
      category: svc.category,
      variants: variants
        .filter((v) => v.serviceId === svc.id)
        .sort((a, b) => a.sort - b.sort)
        .map((v) => ({ id: v.id, name: v.name, price: v.price })),
    }));
}

/** The last few counter payments today, newest first, for the receipt links on the cashier screen. */
export async function recentTransactions(db: Database, branchId: string, date: string, limit = 6) {
  const start = new Date(`${date}T00:00:00+08:00`);
  return db
    .select({
      id: s.transactions.id,
      total: s.transactions.total,
      method: s.transactions.method,
      createdAt: s.transactions.createdAt,
      barber: s.barbers.name,
    })
    .from(s.transactions)
    .leftJoin(s.barbers, eq(s.transactions.barberId, s.barbers.id))
    .where(and(eq(s.transactions.branchId, branchId), gte(s.transactions.createdAt, start)))
    .orderBy(desc(s.transactions.createdAt))
    .limit(limit);
}
