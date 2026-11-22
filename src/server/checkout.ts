import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { type BillItem, bill, CheckoutError, creditAvailable, type Method } from "@/domain/checkout";
import * as q from "@/domain/queue";
import { addDays } from "@/domain/time";
import type { Tx } from "@/server/enqueue";

export type PayInput = {
  entryId: string;
  items: { serviceId: string; variantId?: string; price?: number }[];
  edc: "edc_card" | "edc_qris";
  /** WhatsApp number to look up credit and link the customer. Optional. */
  phone?: string;
  useCredit?: number;
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

    const items = await priceAtCounter(tx, entry.barberId, input.items);

    let customerId = entry.customerId;
    let available = 0;
    const phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone) throw new CheckoutError("Nomor WhatsApp belum benar.");
    if (phone) {
      const rows = await tx.select().from(s.creditLedger).where(eq(s.creditLedger.phone, phone));
      available = creditAvailable(rows, now);
      const [customer] = await tx.select().from(s.customers).where(eq(s.customers.phone, phone));
      customerId ??= customer?.id ?? null;
    }
    const totals = bill(items, input.edc, Math.min(input.useCredit ?? 0, available));

    const [row] = await tx
      .insert(s.transactions)
      .values({
        branchId: entry.branchId,
        barberId: entry.barberId,
        customerId,
        queueEntryId: entry.id,
        items,
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
async function priceAtCounter(tx: Tx, barberId: string, picks: PayInput["items"]): Promise<BillItem[]> {
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
  return picks.map((pick): BillItem => {
    const svc = services.find((x) => x.id === pick.serviceId);
    if (!svc) throw new CheckoutError("Layanan tidak ditemukan.");
    return priceOne(svc, pick);
  });

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
  return { ...row, creditUsed: credit?.spent ?? 0 };
}

export type Takings = { count: number; total: number; byMethod: Partial<Record<Method | string, number>> };

/** What a branch took today (WITA), by payment method. Online QRIS counts on the day it was paid. */
export async function todayTakings(db: Database, branchId: string, date: string): Promise<Takings> {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(`${addDays(date, 1)}T00:00:00+08:00`);
  const counter = await db
    .select({ method: s.transactions.method, total: s.transactions.total })
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
  const byMethod: Takings["byMethod"] = {};
  for (const t of counter) byMethod[t.method] = (byMethod[t.method] ?? 0) + t.total;
  if (online.length) byMethod.online_qris = online.reduce((sum, b) => sum + b.amount, 0);
  const total = Object.values(byMethod).reduce((sum: number, v) => sum + (v ?? 0), 0);
  return { count: counter.length + online.length, total, byMethod };
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
