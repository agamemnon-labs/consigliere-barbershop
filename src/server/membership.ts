import "server-only";
import { createHash, randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, count, desc, eq, gt, ilike, or } from "drizzle-orm";
import { brand } from "@/config/brand";
import { type Database, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { creditAvailable } from "@/domain/checkout";
import {
  DEFAULT_BIRTHDAY,
  DEFAULT_POINTS,
  isBirthdayMonth,
  ledgerTotal,
  MemberError,
  memberNoFor,
  pinProblem,
  topupRows,
} from "@/domain/membership";
import { OTP_MINUTES, otpBody } from "@/domain/notify";
import { shopDate } from "@/domain/time";
import type { Cashier } from "@/server/checkout";
import { numberSetting, type Tx } from "@/server/enqueue";
import { queueMessage } from "@/server/whatsapp";

const LOCK_AFTER = 5;
const LOCK_MIN = 15;

export async function pointsRule(db: Database | Tx) {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "points"));
  return { ...DEFAULT_POINTS, ...(row?.value as object | undefined) };
}

export async function birthdayRule(db: Database | Tx) {
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, "birthday_discount"));
  return { ...DEFAULT_BIRTHDAY, ...(row?.value as object | undefined) };
}

export type MemberSummary = NonNullable<Awaited<ReturnType<typeof findMember>>>;

/** A member by card number (as the QR scanner types it) or WhatsApp number. */
export async function findMember(db: Database | Tx, query: string, now: Date) {
  const q = query.trim();
  if (!q) return null;
  const phone = normalizePhone(q);
  const [row] = await db
    .select({ member: s.members, customer: s.customers })
    .from(s.members)
    .innerJoin(s.customers, eq(s.members.customerId, s.customers.id))
    .where(
      phone ? or(eq(s.customers.phone, phone), ilike(s.members.memberNo, q)) : ilike(s.members.memberNo, q),
    );
  if (!row) return null;
  return summarize(db, row.member, row.customer, now);
}

export async function findMemberById(db: Database | Tx, id: string, now: Date) {
  const [row] = await db
    .select({ member: s.members, customer: s.customers })
    .from(s.members)
    .innerJoin(s.customers, eq(s.members.customerId, s.customers.id))
    .where(eq(s.members.id, id));
  return row ? summarize(db, row.member, row.customer, now) : null;
}

async function summarize(
  db: Database | Tx,
  member: typeof s.members.$inferSelect,
  customer: typeof s.customers.$inferSelect,
  now: Date,
) {
  const [points, balance] = await Promise.all([
    db
      .select({ delta: s.pointLedger.delta })
      .from(s.pointLedger)
      .where(eq(s.pointLedger.memberId, member.id)),
    db
      .select({ delta: s.balanceLedger.delta })
      .from(s.balanceLedger)
      .where(eq(s.balanceLedger.memberId, member.id)),
  ]);
  return {
    id: member.id,
    memberNo: member.memberNo,
    name: customer.name,
    phone: customer.phone ?? "",
    customerId: customer.id,
    userId: member.userId,
    dob: member.dob,
    status: member.status,
    points: ledgerTotal(points),
    balance: ledgerTotal(balance),
    birthday: isBirthdayMonth(member.dob, shopDate(now)),
  };
}

export type NewMember = {
  name: string;
  phone: string;
  dob: string;
  pin: string;
  edc: "edc_card" | "edc_qris";
};

/**
 * Sign-up at the counter: the fee goes through the EDC, the member types their
 * own PIN. Any credit on the number moves into the new balance, which never expires.
 */
export async function createMember(db: Database, input: NewMember, cashier: Cashier, now: Date) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new MemberError("Nomor WhatsApp belum benar.");
  const problem = pinProblem(input.pin);
  if (problem) throw new MemberError(problem);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dob) || input.dob > shopDate(now)) {
    throw new MemberError("Tanggal lahir belum benar.");
  }
  if (!cashier.branchId && cashier.role === "cashier") throw new MemberError("Kasir belum punya cabang.");
  const pinHash = await hashPassword(input.pin);

  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.phoneNumber, phone));
    if (taken) throw new MemberError("Nomor ini sudah terdaftar sebagai member.");

    const [existing] = await tx.select().from(s.customers).where(eq(s.customers.phone, phone));
    const customer =
      existing ?? (await tx.insert(s.customers).values({ name: input.name, phone }).returning())[0];
    if (!customer) throw new Error("Customer was not saved");
    if (existing && existing.name !== input.name) {
      await tx.update(s.customers).set({ name: input.name }).where(eq(s.customers.id, customer.id));
    }

    const [user] = await tx
      .insert(s.users)
      .values({
        name: input.name,
        // Members have no email; the column is required, so this address can never receive mail.
        email: `${phone}@member.consigliere.invalid`,
        phoneNumber: phone,
        phoneNumberVerified: true,
        role: "member",
      })
      .returning();
    if (!user) throw new Error("User was not saved");
    await tx
      .insert(s.accounts)
      .values({ userId: user.id, accountId: user.id, providerId: "credential", password: pinHash });

    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(s.members);
    const [member] = await tx
      .insert(s.members)
      .values({ customerId: customer.id, memberNo: memberNoFor(n + 1), dob: input.dob, userId: user.id })
      .returning();
    if (!member) throw new Error("Member was not saved");

    const fee = await numberSetting(tx, "membership_fee", 30_000);
    const branchId = cashier.branchId ?? (await tx.select({ id: s.branches.id }).from(s.branches))[0]?.id;
    if (!branchId) throw new Error("No branch");
    await tx.insert(s.transactions).values({
      branchId,
      customerId: customer.id,
      memberId: member.id,
      items: [{ serviceId: "membership", name: "Pendaftaran member", price: fee, discount: 0 }],
      subtotal: fee,
      total: fee,
      method: input.edc,
      cashierId: cashier.id,
      createdAt: now,
    });

    const credit = creditAvailable(
      await tx.select().from(s.creditLedger).where(eq(s.creditLedger.phone, phone)),
      now,
    );
    if (credit > 0) {
      await tx.insert(s.creditLedger).values({ phone, delta: -credit, reason: "spend", createdAt: now });
      await tx
        .insert(s.balanceLedger)
        .values({ memberId: member.id, delta: credit, reason: "adjust", ref: "credit", createdAt: now });
    }
    await tx.insert(s.auditLog).values({
      actorId: cashier.id,
      action: "member.create",
      entity: "members",
      after: { id: member.id, memberNo: member.memberNo, creditMoved: credit },
    });
    return { memberNo: member.memberNo, creditMoved: credit };
  });
}

/** Top-up at the counter from an admin-set package. Bonus is its own ledger row. */
export async function topUp(
  db: Database,
  input: { memberId: string; packageId: string; edc: "edc_card" | "edc_qris" },
  cashier: Cashier,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const [pkg] = await tx
      .select()
      .from(s.topupPackages)
      .where(and(eq(s.topupPackages.id, input.packageId), eq(s.topupPackages.isActive, true)));
    if (!pkg) throw new MemberError("Paket top-up tidak ditemukan.");
    const [member] = await tx.select().from(s.members).where(eq(s.members.id, input.memberId));
    if (member?.status !== "active") throw new MemberError("Member tidak aktif.");
    const branchId = cashier.branchId ?? (await tx.select({ id: s.branches.id }).from(s.branches))[0]?.id;
    if (!branchId) throw new Error("No branch");

    const [row] = await tx
      .insert(s.transactions)
      .values({
        branchId,
        customerId: member.customerId,
        memberId: member.id,
        items: [
          {
            serviceId: "topup",
            name: `Top-up saldo (dapat ${pkg.get.toLocaleString("id-ID")})`,
            price: pkg.pay,
            discount: 0,
          },
        ],
        subtotal: pkg.pay,
        total: pkg.pay,
        method: input.edc,
        cashierId: cashier.id,
        createdAt: now,
      })
      .returning({ id: s.transactions.id });
    if (!row) throw new Error("Transaction was not saved");
    await tx
      .insert(s.balanceLedger)
      .values(
        topupRows(pkg).map((r) => ({ ...r, memberId: member.id, transactionId: row.id, createdAt: now })),
      );
    return row.id;
  });
}

/**
 * Checks a member's PIN at the counter (to pay from balance). Five wrong tries
 * lock the card for 15 minutes.
 */
export async function checkPin(db: Database | Tx, memberId: string, pin: string, now: Date): Promise<void> {
  const [member] = await db.select().from(s.members).where(eq(s.members.id, memberId));
  if (!member?.userId) throw new MemberError("Member belum punya PIN.");
  if (member.lockedUntil && member.lockedUntil > now) {
    throw new MemberError("Terlalu banyak PIN salah. Coba lagi 15 menit lagi.");
  }
  const [account] = await db
    .select({ password: s.accounts.password })
    .from(s.accounts)
    .where(and(eq(s.accounts.userId, member.userId), eq(s.accounts.providerId, "credential")));
  const ok = account?.password ? await verifyPassword({ hash: account.password, password: pin }) : false;
  if (ok) {
    if (member.failedPinAttempts) {
      await db
        .update(s.members)
        .set({ failedPinAttempts: 0, lockedUntil: null })
        .where(eq(s.members.id, memberId));
    }
    return;
  }
  const tries = member.failedPinAttempts + 1;
  await db
    .update(s.members)
    .set({
      failedPinAttempts: tries >= LOCK_AFTER ? 0 : tries,
      lockedUntil: tries >= LOCK_AFTER ? new Date(now.getTime() + LOCK_MIN * 60_000) : null,
    })
    .where(eq(s.members.id, memberId));
  throw new MemberError("PIN salah.");
}

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

/**
 * "Lupa PIN": a 6-digit code goes to the member's WhatsApp (through the outbox).
 * Returns the code only so the in-memory demo can show it; never shown otherwise.
 * The caller delivers `messageId` once the response has gone out.
 */
export async function requestPinReset(
  db: Database,
  phoneInput: string,
  now: Date,
): Promise<{ code: string; messageId: string } | null> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return null;
  const [user] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.phoneNumber, phone));
  if (!user) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const identifier = `pin-reset:${phone}`;
  await db.delete(s.verifications).where(eq(s.verifications.identifier, identifier));
  await db.insert(s.verifications).values({
    identifier,
    value: hashCode(code),
    expiresAt: new Date(now.getTime() + OTP_MINUTES * 60_000),
  });
  const messageId = await queueMessage(db, {
    kind: "otp",
    to: phone,
    params: [code],
    body: otpBody(brand.name),
  });
  return { code, messageId };
}

export async function resetPin(db: Database, phoneInput: string, code: string, pin: string, now: Date) {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new MemberError("Nomor WhatsApp belum benar.");
  const problem = pinProblem(pin);
  if (problem) throw new MemberError(problem);
  const identifier = `pin-reset:${phone}`;
  const [row] = await db
    .select()
    .from(s.verifications)
    .where(and(eq(s.verifications.identifier, identifier), gt(s.verifications.expiresAt, now)));
  if (!row || row.value !== hashCode(code.trim()))
    throw new MemberError("Kode salah atau sudah kedaluwarsa.");
  const [user] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.phoneNumber, phone));
  if (!user) throw new MemberError("Nomor ini belum terdaftar sebagai member.");
  await db
    .update(s.accounts)
    .set({ password: await hashPassword(pin) })
    .where(and(eq(s.accounts.userId, user.id), eq(s.accounts.providerId, "credential")));
  await db
    .update(s.members)
    .set({ failedPinAttempts: 0, lockedUntil: null })
    .where(eq(s.members.userId, user.id));
  await db.delete(s.verifications).where(eq(s.verifications.identifier, identifier));
}

/** The member's own card: who, points, balance, and the last things that happened. */
export async function memberCard(db: Database, userId: string, now: Date) {
  const [row] = await db
    .select({ member: s.members, customer: s.customers })
    .from(s.members)
    .innerJoin(s.customers, eq(s.members.customerId, s.customers.id))
    .where(eq(s.members.userId, userId));
  if (!row) return null;
  const summary = await summarize(db, row.member, row.customer, now);
  const visits = await db
    .select({
      id: s.transactions.id,
      createdAt: s.transactions.createdAt,
      total: s.transactions.total,
      items: s.transactions.items,
      branch: s.branches.name,
    })
    .from(s.transactions)
    .innerJoin(s.branches, eq(s.transactions.branchId, s.branches.id))
    .where(eq(s.transactions.memberId, row.member.id))
    .orderBy(desc(s.transactions.createdAt))
    .limit(10);
  const rule = await pointsRule(db);
  return { ...summary, visits, rule };
}

/** What the counter sells: the sign-up fee and the active top-up packages. */
export async function memberDesk(db: Database) {
  const [fee, packages] = await Promise.all([
    numberSetting(db, "membership_fee", 30_000),
    db.select().from(s.topupPackages).where(eq(s.topupPackages.isActive, true)),
  ]);
  return { fee, packages: packages.sort((a, b) => a.pay - b.pay) };
}
