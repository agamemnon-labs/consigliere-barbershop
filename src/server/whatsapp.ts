import "server-only";
import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import { brand } from "@/config/brand";
import { type Database, schema as s } from "@/db";
import { normalizePhone } from "@/domain/booking";
import { dueNearAlerts, nearTurnBody, nearTurnParams, parseAllowlist, underDailyCap } from "@/domain/notify";
import { branchPrefix, type QueueStatus, ticketLabel } from "@/domain/queue";
import { shopDate, shopDayStart } from "@/domain/time";
import type { Tx } from "./enqueue";
import { env } from "./env";

/**
 * WhatsApp through Meta's WhatsApp Cloud API. Every message is written to the
 * outbox first and handed to Meta after the request that caused it has answered.
 * Without WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID nothing leaves the server:
 * messages are only logged, which is what the public demo shows in Admin → Pesan.
 */

export type MessageKind = "otp" | "queue_near";
export type WhatsAppMessage = { kind: MessageKind; to: string; params: string[] };

export interface WhatsAppSender {
  /** Hands one template message to WhatsApp. Returns WhatsApp's message id. */
  send(message: WhatsAppMessage): Promise<string>;
}

export class WhatsAppError extends Error {
  override name = "WhatsAppError";
}

type CloudConfig = {
  token: string;
  phoneNumberId: string;
  version: string;
  templates: Record<MessageKind, string>;
  lang: string;
};

/** The request body for one template message. Exported for tests. */
export function templatePayload(message: WhatsAppMessage, cfg: Pick<CloudConfig, "templates" | "lang">) {
  const text = (value: string) => ({ type: "text", text: value });
  const components =
    message.kind === "otp"
      ? // Authentication template with a copy-code button: the code goes in the body and the button.
        [
          { type: "body", parameters: [text(message.params[0] ?? "")] },
          { type: "button", sub_type: "url", index: "0", parameters: [text(message.params[0] ?? "")] },
        ]
      : [{ type: "body", parameters: message.params.map(text) }];
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: message.to,
    type: "template",
    template: { name: cfg.templates[message.kind], language: { code: cfg.lang }, components },
  };
}

export function cloudApiSender(cfg: CloudConfig, fetchImpl: typeof fetch = fetch): WhatsAppSender {
  const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`;
  return {
    async send(message) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
        body: JSON.stringify(templatePayload(message, cfg)),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        messages?: { id?: string }[];
        error?: { message?: string; code?: number };
      };
      const id = data.messages?.[0]?.id;
      if (!res.ok || !id) {
        const why = data.error?.message ?? `HTTP ${res.status}`;
        throw new WhatsAppError(data.error?.code ? `${why} (kode ${data.error.code})` : why);
      }
      return id;
    },
  };
}

/** The configured sender, or null when WhatsApp isn't set up (messages are only logged). */
export function whatsappSender(): WhatsAppSender | null {
  const e = env();
  if (!e.WHATSAPP_TOKEN || !e.WHATSAPP_PHONE_NUMBER_ID) return null;
  return cloudApiSender({
    token: e.WHATSAPP_TOKEN,
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID,
    version: e.WHATSAPP_API_VERSION,
    templates: { otp: e.WHATSAPP_TEMPLATE_OTP, queue_near: e.WHATSAPP_TEMPLATE_NEAR },
    lang: e.WHATSAPP_TEMPLATE_LANG,
  });
}

export function whatsappConnected(): boolean {
  const e = env();
  return Boolean(e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID);
}

/** Writes a message to the outbox, to be delivered later. `body` is the log copy, never a secret. */
export async function queueMessage(
  db: Database | Tx,
  message: WhatsAppMessage & { body: string },
): Promise<string> {
  const [row] = await db
    .insert(s.outbox)
    .values({ ...message, status: "pending" })
    .returning({ id: s.outbox.id });
  if (!row) throw new Error("Outbox row was not inserted");
  return row.id;
}

type DeliverOptions = { sender?: WhatsAppSender | null; allowlist?: Set<string>; now?: Date };

/**
 * Hands pending outbox rows to WhatsApp, one by one. Never throws: a failure is
 * written on the row for the admin to see. Template values (a code, a name) are
 * cleared from the row once it is handled.
 */
export async function deliver(db: Database, ids: string[], options: DeliverOptions = {}) {
  if (ids.length === 0) return;
  const sender = options.sender === undefined ? whatsappSender() : options.sender;
  const allowlist = options.allowlist ?? parseAllowlist(env().WHATSAPP_ALLOWLIST, normalizePhone);
  const now = options.now ?? new Date();
  const rows = await db
    .select()
    .from(s.outbox)
    .where(and(inArray(s.outbox.id, ids), eq(s.outbox.status, "pending")))
    .orderBy(asc(s.outbox.createdAt));

  for (const row of rows) {
    const done = (patch: Partial<typeof s.outbox.$inferInsert>) =>
      db
        .update(s.outbox)
        .set({ params: null, ...patch })
        .where(eq(s.outbox.id, row.id));

    if (!sender) {
      await done({ status: "logged" });
      continue;
    }
    if (allowlist.size > 0 && !allowlist.has(row.to)) {
      await done({ status: "skipped", error: "Nomor di luar daftar uji" });
      continue;
    }
    const [{ n } = { n: 0 }] = await db
      .select({ n: count() })
      .from(s.outbox)
      .where(
        and(
          eq(s.outbox.to, row.to),
          eq(s.outbox.status, "sent"),
          gte(s.outbox.createdAt, shopDayStart(shopDate(now))),
        ),
      );
    if (!underDailyCap(n)) {
      await done({ status: "skipped", error: "Batas pesan harian nomor ini" });
      continue;
    }
    try {
      const providerId = await sender.send({
        kind: (row.kind ?? "otp") as MessageKind,
        to: row.to,
        params: row.params ?? [],
      });
      await done({ status: "sent", providerId, sentAt: new Date(), error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await done({ status: "failed", error: message.slice(0, 300) });
    }
  }
}

/**
 * After a barber's line moved: writes a "your turn is near" message for everyone
 * who now has two people or fewer ahead and hasn't had one. Returns the outbox ids.
 */
export async function nearTurnAlerts(db: Database, barberId: string, date: string, now: Date) {
  return db.transaction(async (tx) => {
    // Same lock the queue actions take, so the line can't move under us.
    await tx
      .select({ id: s.queueEntries.id })
      .from(s.queueEntries)
      .where(and(eq(s.queueEntries.barberId, barberId), eq(s.queueEntries.date, date)))
      .for("update");
    const line = await tx
      .select({
        id: s.queueEntries.id,
        position: s.queueEntries.position,
        status: s.queueEntries.status,
        calledAt: s.queueEntries.calledAt,
        graceUntil: s.queueEntries.graceUntil,
        startedAt: s.queueEntries.startedAt,
        lateMoves: s.queueEntries.lateMoves,
        estimatedMin: s.queueEntries.estimatedMin,
        nearAlertAt: s.queueEntries.nearAlertAt,
        ticketNo: s.queueEntries.ticketNo,
        displayName: s.queueEntries.displayName,
        phone: s.customers.phone,
        customerName: s.customers.name,
        branch: s.branches.name,
      })
      .from(s.queueEntries)
      .innerJoin(s.branches, eq(s.queueEntries.branchId, s.branches.id))
      .leftJoin(s.customers, eq(s.queueEntries.customerId, s.customers.id))
      .where(and(eq(s.queueEntries.barberId, barberId), eq(s.queueEntries.date, date)));

    const ids: string[] = [];
    for (const { entry, ahead } of dueNearAlerts(
      line.map((e) => ({ ...e, status: e.status as QueueStatus })),
    )) {
      const facts = {
        name: entry.displayName ?? entry.customerName?.split(/\s+/)[0] ?? "Kak",
        branch: entry.branch,
        ahead,
        ticket: ticketLabel(branchPrefix(entry.branch), entry.ticketNo),
      };
      await tx.update(s.queueEntries).set({ nearAlertAt: now }).where(eq(s.queueEntries.id, entry.id));
      ids.push(
        await queueMessage(tx, {
          kind: "queue_near",
          to: entry.phone as string,
          params: nearTurnParams(facts),
          body: nearTurnBody(brand.name, facts),
        }),
      );
    }
    return ids;
  });
}
