import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, or } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { DEFAULT_BIRTHDAY, DEFAULT_POINTS } from "@/domain/membership";
import { AdminError, type Cell, copyWeek, weekDates } from "@/domain/report";
import { addDays } from "@/domain/time";
import type { Tx } from "@/server/enqueue";
import { findMemberById } from "@/server/membership";

type Actor = { id: string };

async function audit(
  tx: Database | Tx,
  actor: Actor,
  action: string,
  entity: string,
  before: unknown,
  after: unknown,
) {
  await tx.insert(s.auditLog).values({ actorId: actor.id, action, entity, before, after });
}

/* ── Rotation ─────────────────────────────────────────────────────────── */

/** The week grid: every active barber, seven days, each cell a branch id, "off", or "" (not planned). */
export async function rotationWeek(db: Database, monday: string) {
  const dates = weekDates(monday);
  const [barbers, branches, shifts] = await Promise.all([
    db.select().from(s.barbers).where(eq(s.barbers.isActive, true)).orderBy(asc(s.barbers.name)),
    db.select({ id: s.branches.id, name: s.branches.name }).from(s.branches).orderBy(asc(s.branches.name)),
    db
      .select()
      .from(s.barberShifts)
      .where(and(gte(s.barberShifts.date, dates[0] ?? monday), lte(s.barberShifts.date, dates[6] ?? monday))),
  ]);
  const cell = (barberId: string, date: string) => {
    const sh = shifts.find((x) => x.barberId === barberId && x.date === date);
    return !sh ? "" : sh.status === "off" ? "off" : (sh.branchId ?? "");
  };
  return {
    dates,
    branches,
    rows: barbers.map((b) => ({ id: b.id, name: b.name, cells: dates.map((d) => cell(b.id, d)) })),
  };
}

/** Saves grid cells. Branch ids must exist; "" clears a day back to "not planned". */
export async function saveRotation(db: Database, cells: Cell[], actor: Actor) {
  if (cells.length === 0) return 0;
  const branchIds = new Set((await db.select({ id: s.branches.id }).from(s.branches)).map((b) => b.id));
  for (const c of cells) {
    if (c.value && c.value !== "off" && !branchIds.has(c.value)) throw new AdminError("Cabang tidak dikenal");
  }
  return db.transaction(async (tx) => {
    let changed = 0;
    for (const c of cells) {
      const where = and(eq(s.barberShifts.barberId, c.barberId), eq(s.barberShifts.date, c.date));
      const [old] = await tx.select().from(s.barberShifts).where(where);
      const was = !old ? "" : old.status === "off" ? "off" : (old.branchId ?? "");
      if (was === c.value) continue;
      changed += 1;
      if (!c.value) {
        await tx.delete(s.barberShifts).where(where);
        continue;
      }
      const row =
        c.value === "off"
          ? { status: "off" as const, branchId: null }
          : { status: "on" as const, branchId: c.value };
      if (old) await tx.update(s.barberShifts).set(row).where(where);
      else await tx.insert(s.barberShifts).values({ barberId: c.barberId, date: c.date, ...row });
    }
    if (changed) await audit(tx, actor, "rotation.save", "barber_shifts", null, { cells: changed });
    return changed;
  });
}

/** "Salin minggu lalu": last week's plan onto this week, overwriting it. */
export async function copyLastWeek(db: Database, monday: string, actor: Actor) {
  const previous = await rotationWeek(db, addDays(monday, -7));
  const cells: Cell[] = previous.rows.flatMap((r) =>
    r.cells.map((value, i) => ({ barberId: r.id, date: previous.dates[i] ?? "", value })),
  );
  return saveRotation(db, copyWeek(cells, addDays(monday, -7)), actor);
}

/* ── Prices, levels and barbers ───────────────────────────────────────── */

export async function priceBook(db: Database) {
  const [services, variants, levels] = await Promise.all([
    db.select().from(s.services).orderBy(asc(s.services.sort)),
    db.select().from(s.serviceVariants).orderBy(asc(s.serviceVariants.sort)),
    db.select().from(s.barberLevels).orderBy(asc(s.barberLevels.sort)),
  ]);
  return {
    services: services.map((x) => ({ ...x, variants: variants.filter((v) => v.serviceId === x.id) })),
    levels,
  };
}

const money = (n: number | undefined, label: string) => {
  if (n === undefined) return undefined;
  if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000) throw new AdminError(`${label} belum benar`);
  return n;
};

export type ServiceEdit = {
  id: string;
  price?: number;
  priceFrom?: number;
  durationMin: number;
  isActive: boolean;
  variants: { id: string; price: number }[];
};

export async function updateService(db: Database, edit: ServiceEdit, actor: Actor) {
  if (!Number.isInteger(edit.durationMin) || edit.durationMin < 5 || edit.durationMin > 480) {
    throw new AdminError("Durasi 5 sampai 480 menit");
  }
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(s.services).where(eq(s.services.id, edit.id));
    if (!before) throw new AdminError("Layanan tidak ditemukan");
    const patch = {
      durationMin: edit.durationMin,
      isActive: edit.isActive,
      ...(before.priceType === "fixed" ? { price: money(edit.price, "Harga") } : {}),
      ...(before.priceType === "from" ? { priceFrom: money(edit.priceFrom, "Harga mulai") } : {}),
    };
    await tx.update(s.services).set(patch).where(eq(s.services.id, edit.id));
    for (const v of edit.variants) {
      await tx
        .update(s.serviceVariants)
        .set({ price: money(v.price, "Harga ukuran") ?? 0 })
        .where(and(eq(s.serviceVariants.id, v.id), eq(s.serviceVariants.serviceId, edit.id)));
    }
    await audit(tx, actor, "service.update", "services", before, { ...patch, variants: edit.variants });
  });
}

export async function updateLevel(
  db: Database,
  edit: { id: string; haircutPrice: number; commissionPercent: number },
  actor: Actor,
) {
  money(edit.haircutPrice, "Harga haircut");
  if (!(edit.commissionPercent >= 0 && edit.commissionPercent <= 100))
    throw new AdminError("Komisi 0 sampai 100%");
  const [before] = await db.select().from(s.barberLevels).where(eq(s.barberLevels.id, edit.id));
  if (!before) throw new AdminError("Level tidak ditemukan");
  const after = { haircutPrice: edit.haircutPrice, commissionBps: Math.round(edit.commissionPercent * 100) };
  await db.update(s.barberLevels).set(after).where(eq(s.barberLevels.id, edit.id));
  await audit(db, actor, "level.update", "barber_levels", before, after);
}

export async function barberList(db: Database) {
  const [barbers, levels] = await Promise.all([
    db.select().from(s.barbers).orderBy(asc(s.barbers.name)),
    db.select().from(s.barberLevels).orderBy(asc(s.barberLevels.sort)),
  ]);
  return { barbers, levels };
}

/**
 * A level change from a date (today or later). The history keeps the old level
 * for past days, so commission on earlier sales is unchanged.
 */
export async function changeLevel(
  db: Database,
  input: { barberId: string; levelId: string; from: string },
  today: string,
  actor: Actor,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || input.from < today) {
    throw new AdminError("Mulai berlaku hari ini atau nanti");
  }
  await db.transaction(async (tx) => {
    const [barber] = await tx.select().from(s.barbers).where(eq(s.barbers.id, input.barberId));
    const [level] = await tx.select().from(s.barberLevels).where(eq(s.barberLevels.id, input.levelId));
    if (!barber || !level) throw new AdminError("Barber atau level tidak ditemukan");
    await tx
      .insert(s.barberLevelHistory)
      .values({ barberId: barber.id, levelId: level.id, effectiveFrom: input.from })
      .onConflictDoUpdate({
        target: [s.barberLevelHistory.barberId, s.barberLevelHistory.effectiveFrom],
        set: { levelId: level.id },
      });
    if (input.from === today)
      await tx.update(s.barbers).set({ levelId: level.id }).where(eq(s.barbers.id, barber.id));
    await audit(tx, actor, "barber.level", "barbers", { levelId: barber.levelId }, input);
  });
}

/** Applies level changes whose day has come. Cheap; called when the back office or the site reads barbers. */
export async function applyDueLevels(db: Database, today: string) {
  const history = await db
    .select()
    .from(s.barberLevelHistory)
    .where(lte(s.barberLevelHistory.effectiveFrom, today))
    .orderBy(desc(s.barberLevelHistory.effectiveFrom));
  const latest = new Map<string, string>();
  for (const h of history) if (!latest.has(h.barberId)) latest.set(h.barberId, h.levelId);
  const barbers = await db.select({ id: s.barbers.id, levelId: s.barbers.levelId }).from(s.barbers);
  for (const b of barbers) {
    const due = latest.get(b.id);
    if (due && due !== b.levelId)
      await db.update(s.barbers).set({ levelId: due }).where(eq(s.barbers.id, b.id));
  }
}

export async function setBarberActive(db: Database, barberId: string, isActive: boolean, actor: Actor) {
  await db.update(s.barbers).set({ isActive }).where(eq(s.barbers.id, barberId));
  await audit(db, actor, isActive ? "barber.activate" : "barber.deactivate", "barbers", null, { barberId });
}

/* ── Members ──────────────────────────────────────────────────────────── */

export async function memberList(db: Database, query: string) {
  const q = query.trim();
  const phone = q ? normalizePhone(q) : null;
  const where = q
    ? or(
        ilike(s.members.memberNo, `%${q}%`),
        ilike(s.customers.name, `%${q}%`),
        ...(phone ? [eq(s.customers.phone, phone)] : []),
      )
    : undefined;
  return db
    .select({
      id: s.members.id,
      memberNo: s.members.memberNo,
      name: s.customers.name,
      phone: s.customers.phone,
      status: s.members.status,
    })
    .from(s.members)
    .innerJoin(s.customers, eq(s.members.customerId, s.customers.id))
    .where(where)
    .orderBy(desc(s.members.memberNo))
    .limit(50);
}

export async function memberDetail(db: Database, id: string, now: Date) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const summary = await findMemberById(db, id, now);
  if (!summary) return null;
  const [points, balance] = await Promise.all([
    db
      .select()
      .from(s.pointLedger)
      .where(eq(s.pointLedger.memberId, id))
      .orderBy(desc(s.pointLedger.createdAt))
      .limit(30),
    db
      .select()
      .from(s.balanceLedger)
      .where(eq(s.balanceLedger.memberId, id))
      .orderBy(desc(s.balanceLedger.createdAt))
      .limit(30),
  ]);
  return { ...summary, points: summary.points, history: { points, balance } };
}

export async function updateMember(
  db: Database,
  input: { id: string; name: string; memberNo: string; status: "active" | "suspended" },
  actor: Actor,
) {
  const memberNo = input.memberNo.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9-]{2,20}$/.test(memberNo)) throw new AdminError("Nomor member 2–20 huruf atau angka");
  if (name.length < 2) throw new AdminError("Nama minimal 2 huruf");
  await db.transaction(async (tx) => {
    const [member] = await tx.select().from(s.members).where(eq(s.members.id, input.id));
    if (!member) throw new AdminError("Member tidak ditemukan");
    const [taken] = await tx
      .select({ id: s.members.id })
      .from(s.members)
      .where(and(eq(s.members.memberNo, memberNo), ne(s.members.id, member.id)));
    if (taken) throw new AdminError("Nomor member sudah dipakai");
    await tx.update(s.members).set({ memberNo, status: input.status }).where(eq(s.members.id, member.id));
    await tx.update(s.customers).set({ name }).where(eq(s.customers.id, member.customerId));
    if (member.userId) await tx.update(s.users).set({ name }).where(eq(s.users.id, member.userId));
    await audit(
      tx,
      actor,
      "member.update",
      "members",
      { memberNo: member.memberNo, status: member.status },
      input,
    );
  });
}

/** A manual correction to points or balance, always with a reason, never below zero. */
export async function adjustMember(
  db: Database,
  input: { id: string; kind: "points" | "balance"; delta: number; reason: string },
  now: Date,
  actor: Actor,
) {
  const reason = input.reason.trim();
  if (!Number.isSafeInteger(input.delta) || input.delta === 0)
    throw new AdminError("Isi jumlah, boleh minus");
  if (reason.length < 3) throw new AdminError("Tulis alasannya");
  await db.transaction(async (tx) => {
    const member = await findMemberById(tx, input.id, now);
    if (!member) throw new AdminError("Member tidak ditemukan");
    const current = input.kind === "points" ? member.points : member.balance;
    if (current + input.delta < 0) throw new AdminError("Hasilnya tidak boleh minus");
    if (input.kind === "points") {
      await tx
        .insert(s.pointLedger)
        .values({ memberId: member.id, delta: input.delta, reason: `adjust: ${reason}` });
    } else {
      await tx
        .insert(s.balanceLedger)
        .values({ memberId: member.id, delta: input.delta, reason: "adjust", ref: reason });
    }
    await audit(tx, actor, `member.adjust.${input.kind}`, "members", { [input.kind]: current }, input);
  });
}

/* ── Rules ────────────────────────────────────────────────────────────── */

export async function rules(db: Database) {
  const [rows, packages] = await Promise.all([
    db.select().from(s.settings),
    db.select().from(s.topupPackages).orderBy(asc(s.topupPackages.pay)),
  ]);
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const num = (key: string, fallback: number) => {
    const v = get(key);
    return typeof v === "number" ? v : fallback;
  };
  return {
    membershipFee: num("membership_fee", 30_000),
    points: { ...DEFAULT_POINTS, ...(get("points") as object | undefined) },
    birthday: { ...DEFAULT_BIRTHDAY, ...(get("birthday_discount") as object | undefined) },
    graceMinutes: num("queue_grace_minutes", 5),
    creditDays: num("credit_valid_days", 30),
    pendingMinutes: num("pending_booking_minutes", 15),
    onlineClosesBefore: num("online_queue_closes_before_min", 45),
    commissionPercent: num("default_commission_bps", 4_000) / 100,
    packages,
  };
}

export type Rules = Awaited<ReturnType<typeof rules>>;
type RuleInput = Omit<Rules, "packages">;

const CATEGORIES = ["haircut", "chemical", "refreshment", "package"];

export async function saveRules(db: Database, input: RuleInput, actor: Actor) {
  const whole = (n: number, min: number, max: number, label: string) => {
    if (!Number.isInteger(n) || n < min || n > max) throw new AdminError(`${label} ${min} sampai ${max}`);
    return n;
  };
  const values: Record<string, unknown> = {
    membership_fee: whole(input.membershipFee, 0, 1_000_000, "Biaya member"),
    points: {
      earnPer: whole(input.points.earnPer, 1_000, 1_000_000, "Belanja per poin"),
      redeemPoints: whole(input.points.redeemPoints, 1, 1_000, "Poin per potongan"),
      redeemValue: whole(input.points.redeemValue, 1_000, 1_000_000, "Nilai potongan"),
    },
    birthday_discount: {
      percent: whole(input.birthday.percent, 0, 100, "Diskon ulang tahun"),
      categories: input.birthday.categories.filter((c) => CATEGORIES.includes(c)),
      stacksWithPoints: Boolean(input.birthday.stacksWithPoints),
    },
    queue_grace_minutes: whole(input.graceMinutes, 1, 30, "Waktu tunggu dipanggil"),
    credit_valid_days: whole(input.creditDays, 1, 365, "Masa berlaku kredit"),
    pending_booking_minutes: whole(input.pendingMinutes, 5, 60, "Batas waktu bayar"),
    online_queue_closes_before_min: whole(input.onlineClosesBefore, 0, 240, "Antrean online tutup"),
    default_commission_bps: Math.round(
      whole(Math.round(input.commissionPercent), 0, 100, "Komisi layanan lain") * 100,
    ),
  };
  await db.transaction(async (tx) => {
    const before = await tx
      .select()
      .from(s.settings)
      .where(inArray(s.settings.key, Object.keys(values)));
    for (const [key, value] of Object.entries(values)) {
      await tx
        .insert(s.settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: s.settings.key, set: { value } });
    }
    await audit(tx, actor, "rules.save", "settings", before, values);
  });
}

export async function savePackage(
  db: Database,
  input: { id?: string; pay: number; get: number; isActive: boolean },
  actor: Actor,
) {
  money(input.pay, "Bayar");
  money(input.get, "Dapat");
  if (input.pay < 10_000) throw new AdminError("Minimal Rp10.000");
  if (input.get < input.pay)
    throw new AdminError("Saldo yang didapat tidak boleh lebih kecil dari yang dibayar");
  const row = { pay: input.pay, get: input.get, isActive: input.isActive };
  if (input.id) await db.update(s.topupPackages).set(row).where(eq(s.topupPackages.id, input.id));
  else await db.insert(s.topupPackages).values(row);
  await audit(
    db,
    actor,
    input.id ? "topup_package.update" : "topup_package.create",
    "topup_packages",
    null,
    input,
  );
}

/* ── Outbox ───────────────────────────────────────────────────────────── */

export function outboxList(db: Database) {
  return db.select().from(s.outbox).orderBy(desc(s.outbox.createdAt)).limit(50);
}
