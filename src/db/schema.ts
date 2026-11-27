/**
 * Database schema. One brand, three branches, one database.
 *
 * Conventions
 * - Money is integer rupiah (`integer`), never floats.
 * - Balances and points are ledgers: the current value is the sum of rows.
 * - Every table has RLS enabled with no policies. The app talks to Postgres
 *   directly from the server (owner role, bypasses RLS), so the public
 *   Supabase API key can read nothing until a policy says so (phase 3 adds
 *   read policies for the live queue).
 * - Column names are snake_case in SQL, camelCase in TypeScript
 *   (`casing: "snake_case"` in drizzle.config.ts and the client).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/* ── Enums ─────────────────────────────────────────────────────────────── */

export const userRole = pgEnum("user_role", ["member", "cashier", "admin", "owner"]);
export const shiftStatus = pgEnum("shift_status", ["on", "off"]);
export const serviceCategory = pgEnum("service_category", ["haircut", "chemical", "refreshment", "package"]);
/** fixed: one price · from: "mulai dari" · by_level: haircut, priced by barber level · variant: short/long etc. */
export const priceType = pgEnum("price_type", ["fixed", "from", "by_level", "variant"]);
export const queueSource = pgEnum("queue_source", ["online", "walkin"]);
export const queueStatus = pgEnum("queue_status", [
  "waiting",
  "called",
  "in_service",
  "done",
  "no_show",
  "cancelled",
]);
export const bookingStatus = pgEnum("booking_status", ["pending", "paid", "expired", "credited", "refunded"]);
export const paymentMethod = pgEnum("payment_method", [
  "edc_card",
  "edc_qris",
  "online_qris",
  "balance",
  "credit",
  "mixed",
]);
export const creditReason = pgEnum("credit_reason", ["cancel", "no_show", "spend", "expire", "manual"]);
export const balanceReason = pgEnum("balance_reason", ["topup", "bonus", "spend", "refund", "adjust"]);
export const memberStatus = pgEnum("member_status", ["active", "suspended"]);

/* ── Branches, barbers, rotation ───────────────────────────────────────── */

export const branches = pgTable("branches", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  address: text().notNull(),
  mapsUrl: text(),
  /** e.g. { "mon": ["10:00","22:00"], ... } */
  openHours: jsonb().$type<Record<string, [string, string] | null>>().notNull(),
  isActive: boolean().notNull().default(true),
}).enableRLS();

export const barberLevels = pgTable("barber_levels", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  haircutPrice: integer().notNull(),
  /** Barber's share of the haircut price, in basis points (4000 = 40%). */
  commissionBps: integer().notNull().default(4000),
  sort: smallint().notNull(),
}).enableRLS();

export const barbers = pgTable("barbers", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  photoUrl: text(),
  levelId: uuid()
    .notNull()
    .references(() => barberLevels.id),
  bio: text(),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
}).enableRLS();

export const barberLevelHistory = pgTable(
  "barber_level_history",
  {
    barberId: uuid()
      .notNull()
      .references(() => barbers.id, { onDelete: "cascade" }),
    levelId: uuid()
      .notNull()
      .references(() => barberLevels.id),
    effectiveFrom: date().notNull(),
  },
  (t) => [primaryKey({ columns: [t.barberId, t.effectiveFrom] })],
).enableRLS();

/** Daily rotation. A day off is a row with status `off` (or no row at all). */
export const barberShifts = pgTable(
  "barber_shifts",
  {
    id: id(),
    barberId: uuid()
      .notNull()
      .references(() => barbers.id, { onDelete: "cascade" }),
    branchId: uuid().references(() => branches.id),
    date: date().notNull(),
    start: time(),
    end: time(),
    status: shiftStatus().notNull().default("on"),
  },
  (t) => [
    uniqueIndex().on(t.barberId, t.date),
    index().on(t.branchId, t.date),
    check("shift_on_needs_branch", sql`${t.status} = 'off' or ${t.branchId} is not null`),
  ],
).enableRLS();

/**
 * Days a branch is closed (Lebaran, Natal…). Null branch = every branch.
 * Customer pages show the reason as a banner; online queue stays shut.
 */
export const closures = pgTable(
  "closures",
  {
    id: id(),
    branchId: uuid().references(() => branches.id, { onDelete: "cascade" }),
    date: date().notNull(),
    reason: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.date)],
).enableRLS();

/* ── Services & prices ─────────────────────────────────────────────────── */

export const services = pgTable("services", {
  id: id(),
  slug: text().notNull().unique(),
  category: serviceCategory().notNull(),
  name: text().notNull(),
  description: text(),
  /** Minutes; drives wait estimates. Admin-editable. */
  durationMin: smallint().notNull(),
  priceType: priceType().notNull(),
  /** For `fixed`. */
  price: integer(),
  /** For `from` ("mulai dari"). */
  priceFrom: integer(),
  sort: smallint().notNull().default(0),
  isActive: boolean().notNull().default(true),
}).enableRLS();

export const serviceVariants = pgTable("service_variants", {
  id: id(),
  serviceId: uuid()
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  name: text().notNull(),
  price: integer().notNull(),
  durationMin: smallint().notNull(),
  sort: smallint().notNull().default(0),
}).enableRLS();

export const packageItems = pgTable(
  "package_items",
  {
    packageId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.serviceId] })],
).enableRLS();

/* ── People ────────────────────────────────────────────────────────────── */

/** Anyone who has booked or been served. Booking needs no account. */
export const customers = pgTable("customers", {
  id: id(),
  name: text().notNull(),
  /** WhatsApp number, E.164 without plus (62…). */
  phone: text().unique(),
  createdAt: createdAt(),
}).enableRLS();

export const members = pgTable("members", {
  id: id(),
  customerId: uuid()
    .notNull()
    .unique()
    .references(() => customers.id),
  /** Editable by admin. */
  memberNo: text().notNull().unique(),
  dob: date().notNull(),
  /** Login account (phone + PIN), created at sign-up. */
  userId: uuid()
    .unique()
    .references(() => users.id),
  failedPinAttempts: smallint().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true }),
  joinedAt: createdAt(),
  status: memberStatus().notNull().default("active"),
}).enableRLS();

/* ── Auth (Better Auth) ────────────────────────────────────────────────
 * Table shapes follow Better Auth's core schema plus our own fields.
 * Staff (cashier/admin/owner) sign in with email + password. Members (phase 6)
 * sign in with phone + 6-digit PIN through the phone-number plugin and get a
 * `members` row. `role` and `branchId` are server-only fields.
 */

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  /** Members sign in with this (62…) and a 6-digit PIN. Staff leave it empty. */
  phoneNumber: text().unique(),
  phoneNumberVerified: boolean(),
  image: text(),
  role: userRole().notNull().default("member"),
  /** Home branch for cashiers; null for admin, owner and members. */
  branchId: uuid().references(() => branches.id),
  isActive: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    /** Better Auth's hash (scrypt). Never select this outside auth code. */
    password: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
).enableRLS();

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.identifier)],
).enableRLS();

/** Rate-limit counters, kept in Postgres so they hold across serverless instances. */
export const rateLimits = pgTable("rate_limits", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
}).enableRLS();

/** Long-lived token for the counter tablet / TV, bound to one branch. */
export const displayDevices = pgTable("display_devices", {
  id: id(),
  branchId: uuid()
    .notNull()
    .references(() => branches.id),
  label: text().notNull(),
  tokenHash: text().notNull().unique(),
  lastSeenAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
}).enableRLS();

/* ── Queue & bookings ──────────────────────────────────────────────────── */

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    branchId: uuid()
      .notNull()
      .references(() => branches.id),
    barberId: uuid().references(() => barbers.id),
    /** Snapshot of chosen services at booking time. */
    services: jsonb()
      .$type<
        {
          serviceId: string;
          variantId?: string;
          name: string;
          price: number;
          durationMin: number;
        }[]
      >()
      .notNull(),
    amount: integer().notNull(),
    status: bookingStatus().notNull().default("pending"),
    paymentId: text().unique(),
    /** The QRIS payload to render while the booking waits for payment. */
    qrString: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status, t.expiresAt)],
).enableRLS();

export const queueEntries = pgTable(
  "queue_entries",
  {
    id: id(),
    branchId: uuid()
      .notNull()
      .references(() => branches.id),
    barberId: uuid()
      .notNull()
      .references(() => barbers.id),
    date: date().notNull(),
    position: integer().notNull(),
    /** The number on the ticket stub, per branch per day (A-001…). */
    ticketNo: integer().notNull(),
    customerId: uuid().references(() => customers.id),
    displayName: text(),
    source: queueSource().notNull(),
    status: queueStatus().notNull().default("waiting"),
    calledAt: timestamp({ withTimezone: true }),
    graceUntil: timestamp({ withTimezone: true }),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    lateMoves: smallint().notNull().default(0),
    bookingId: uuid().references(() => bookings.id),
    estimatedMin: smallint().notNull(),
    /** When the "2 people left" WhatsApp went out, or was skipped because the line was already short. */
    nearAlertAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.barberId, t.date, t.position), uniqueIndex().on(t.branchId, t.date, t.ticketNo)],
).enableRLS();

/**
 * A customer's 1–5 score for one finished visit, given from their ticket page. One per visit;
 * barber and branch are copied from the visit so reports need no join.
 */
export const ratings = pgTable(
  "ratings",
  {
    id: id(),
    queueEntryId: uuid()
      .notNull()
      .unique()
      .references(() => queueEntries.id, { onDelete: "cascade" }),
    barberId: uuid()
      .notNull()
      .references(() => barbers.id),
    branchId: uuid()
      .notNull()
      .references(() => branches.id),
    date: date().notNull(),
    score: smallint().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.date, t.barberId), check("ratings_score_range", sql`${t.score} between 1 and 5`)],
).enableRLS();

/* ── Money ─────────────────────────────────────────────────────────────── */

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    branchId: uuid()
      .notNull()
      .references(() => branches.id),
    barberId: uuid().references(() => barbers.id),
    customerId: uuid().references(() => customers.id),
    memberId: uuid().references(() => members.id),
    queueEntryId: uuid().references(() => queueEntries.id),
    items: jsonb().$type<{ serviceId: string; name: string; price: number; discount: number }[]>().notNull(),
    subtotal: integer().notNull(),
    discounts: integer().notNull().default(0),
    total: integer().notNull(),
    method: paymentMethod().notNull(),
    cashierId: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.branchId, t.createdAt), index().on(t.barberId, t.createdAt)],
).enableRLS();

/** 30-day credit tied to a non-member's WhatsApp number. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    phone: text().notNull(),
    delta: integer().notNull(),
    reason: creditReason().notNull(),
    bookingId: uuid().references(() => bookings.id),
    /** The counter payment this credit was spent on. */
    transactionId: uuid().references(() => transactions.id),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.phone)],
).enableRLS();

export const pointLedger = pgTable(
  "point_ledger",
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id),
    delta: integer().notNull(),
    reason: text().notNull(),
    transactionId: uuid().references(() => transactions.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.memberId)],
).enableRLS();

export const balanceLedger = pgTable(
  "balance_ledger",
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id),
    delta: integer().notNull(),
    reason: balanceReason().notNull(),
    ref: text(),
    transactionId: uuid().references(() => transactions.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.memberId)],
).enableRLS();

export const topupPackages = pgTable("topup_packages", {
  id: id(),
  pay: integer().notNull(),
  get: integer().notNull(),
  isActive: boolean().notNull().default(true),
}).enableRLS();

/** A member topping up their balance by QRIS from the phone. Balance is added only once paid. */
export const topupOrders = pgTable(
  "topup_orders",
  {
    id: id(),
    memberId: uuid()
      .notNull()
      .references(() => members.id),
    pay: integer().notNull(),
    get: integer().notNull(),
    status: bookingStatus().notNull().default("pending"),
    paymentId: text().unique(),
    qrString: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    paidAt: timestamp({ withTimezone: true }),
    transactionId: uuid().references(() => transactions.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.memberId, t.createdAt)],
).enableRLS();

/* ── System ────────────────────────────────────────────────────────────── */

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
}).enableRLS();

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid().references(() => users.id),
    action: text().notNull(),
    entity: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entity, t.createdAt)],
).enableRLS();

export const outboxStatus = pgEnum("outbox_status", ["pending", "sent", "failed", "logged", "skipped"]);

/**
 * WhatsApp messages. Every message is written here first, then sent through the
 * WhatsApp Cloud API when it is configured, or only logged when it isn't.
 * `body` is the readable copy for the admin log (one-time codes masked);
 * `params` holds the template values until the message is handed off, then is cleared.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    channel: text().notNull().default("whatsapp"),
    /** "otp" (forgot PIN) or "queue_near" (2 people left). Null on rows from before kinds. */
    kind: text(),
    to: text().notNull(),
    body: text().notNull(),
    params: jsonb().$type<string[]>(),
    status: outboxStatus().notNull().default("logged"),
    /** WhatsApp message id (wamid…) once Meta accepted it. */
    providerId: text(),
    error: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.to, t.createdAt)],
).enableRLS();

/**
 * The chatbot's conversation log, one row per message, for every channel. Feeds the
 * AI brain's short memory, the per-chat daily limit and the admin's view of what
 * customers ask. `chatId` is the channel's own id (a browser id, a Telegram chat id).
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    /** "web", "telegram", later "whatsapp". */
    channel: text().notNull(),
    chatId: text().notNull(),
    /** "user" or "bot". */
    role: text().notNull(),
    body: text().notNull(),
    /** For bot rows: which brain answered, "rules" or "ai". */
    brain: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.channel, t.chatId, t.createdAt), index().on(t.createdAt)],
).enableRLS();
