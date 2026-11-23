import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { DAILY_CAP } from "@/domain/notify";
import { enqueue } from "./enqueue";
import {
  cloudApiSender,
  deliver,
  nearTurnAlerts,
  queueMessage,
  templatePayload,
  type WhatsAppMessage,
  type WhatsAppSender,
} from "./whatsapp";

const DAY = "2026-11-23";
/** A day with no seeded queue, so each test owns its line. */
const LINE_DAY = "2030-01-07";
const now = new Date(`${DAY}T14:00:00+08:00`);
let db: Database;
let branch: { id: string; name: string };
let barbers: { id: string }[];

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
  const [found] = await db.select().from(s.branches).where(eq(s.branches.slug, "citra-niaga"));
  if (!found) throw new Error("no branch");
  branch = found;
  barbers = await db.select({ id: s.barbers.id }).from(s.barbers);
}, 60_000);

/** A sender that records what it was asked to send. */
function recorder(fail?: string): WhatsAppSender & { sent: WhatsAppMessage[] } {
  const sent: WhatsAppMessage[] = [];
  return {
    sent,
    async send(message) {
      if (fail) throw new Error(fail);
      sent.push(message);
      return `wamid.${sent.length}`;
    },
  };
}

async function join(barberId: string, name: string, phone: string | null) {
  return db.transaction(async (tx) => {
    let customerId: string | null = null;
    if (phone) {
      const [c] = await tx.insert(s.customers).values({ name, phone }).returning();
      customerId = c!.id;
    }
    return enqueue(tx, {
      branchId: branch.id,
      barberId,
      date: LINE_DAY,
      source: "walkin",
      displayName: name,
      estimatedMin: 30,
      customerId,
    });
  });
}

const outboxRow = async (id: string) => (await db.select().from(s.outbox).where(eq(s.outbox.id, id)))[0]!;

describe("'your turn is near' on WhatsApp", () => {
  it("tells the third and later customers once the line moves up to them", async () => {
    const barberId = barbers[0]!.id;
    const a = await join(barberId, "Andi", "6281300000001");
    const b = await join(barberId, "Budi", "6281300000002");
    const c = await join(barberId, "Caca", "6281300000003");
    const d = await join(barberId, "Dodi", "6281300000004");
    const e = await join(barberId, "Eka", null);

    // Andi, Budi and Caca joined a short line: no message for them, ever.
    expect(await nearTurnAlerts(db, barberId, LINE_DAY, now)).toEqual([]);

    // Andi is done: Dodi now has two ahead. Eka has no number.
    await db.update(s.queueEntries).set({ status: "done" }).where(eq(s.queueEntries.id, a.id));
    const ids = await nearTurnAlerts(db, barberId, LINE_DAY, now);
    expect(ids).toHaveLength(1);
    const row = await outboxRow(ids[0]!);
    expect(row).toMatchObject({
      kind: "queue_near",
      to: "6281300000004",
      status: "pending",
      params: ["Dodi", "Citra Niaga", "tinggal 2 orang lagi", `C ${String(d.ticketNo).padStart(3, "0")}`],
    });

    // The line moving again doesn't repeat it.
    await db.update(s.queueEntries).set({ status: "done" }).where(eq(s.queueEntries.id, b.id));
    expect(await nearTurnAlerts(db, barberId, LINE_DAY, now)).toEqual([]);
    expect(c.nearAlertAt).not.toBeNull();
    expect(e.nearAlertAt).toBeNull();
  });
});

describe("delivery", () => {
  it("sends, keeps WhatsApp's id and clears the template values", async () => {
    const sender = recorder();
    const id = await queueMessage(db, { kind: "otp", to: "6281400000001", params: ["123456"], body: "log" });
    await deliver(db, [id], { sender, now });
    expect(sender.sent).toEqual([{ kind: "otp", to: "6281400000001", params: ["123456"] }]);
    expect(await outboxRow(id)).toMatchObject({ status: "sent", providerId: "wamid.1", params: null });

    // Delivering again sends nothing twice.
    await deliver(db, [id], { sender, now });
    expect(sender.sent).toHaveLength(1);
  });

  it("only logs when WhatsApp isn't set up", async () => {
    const id = await queueMessage(db, { kind: "otp", to: "6281400000002", params: ["123456"], body: "log" });
    await deliver(db, [id], { sender: null, now });
    expect(await outboxRow(id)).toMatchObject({ status: "logged", params: null, sentAt: null });
  });

  it("writes the reason on the row when WhatsApp refuses", async () => {
    const id = await queueMessage(db, { kind: "otp", to: "6281400000003", params: ["123456"], body: "log" });
    await deliver(db, [id], { sender: recorder("Template name does not exist (kode 132001)"), now });
    expect(await outboxRow(id)).toMatchObject({
      status: "failed",
      error: "Template name does not exist (kode 132001)",
      params: null,
    });
  });

  it("keeps to the allowlist and the daily cap", async () => {
    const sender = recorder();
    const other = await queueMessage(db, { kind: "otp", to: "6281400000004", params: ["1"], body: "log" });
    await deliver(db, [other], { sender, allowlist: new Set(["6281400000005"]), now });
    expect((await outboxRow(other)).status).toBe("skipped");

    const ids: string[] = [];
    for (let i = 0; i <= DAILY_CAP; i++) {
      ids.push(await queueMessage(db, { kind: "otp", to: "6281400000005", params: ["1"], body: "log" }));
    }
    await deliver(db, ids, { sender, now });
    const rows = await db
      .select({ status: s.outbox.status })
      .from(s.outbox)
      .where(and(eq(s.outbox.to, "6281400000005")));
    expect(rows.filter((r) => r.status === "sent")).toHaveLength(DAILY_CAP);
    expect(rows.filter((r) => r.status === "skipped")).toHaveLength(1);
  });
});

describe("WhatsApp Cloud API request", () => {
  const cfg = {
    token: "test-token",
    phoneNumberId: "1234567890",
    version: "v25.0",
    templates: { otp: "kode_pin", queue_near: "antrean_dekat" },
    lang: "id",
  };

  it("puts the code in the body and the copy-code button", () => {
    expect(templatePayload({ kind: "otp", to: "6281200000001", params: ["482913"] }, cfg)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "6281200000001",
      type: "template",
      template: {
        name: "kode_pin",
        language: { code: "id" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "482913" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "482913" }] },
        ],
      },
    });
  });

  it("posts to the phone number's messages endpoint and reads the message id", async () => {
    const calls: [string, RequestInit][] = [];
    const ok = cloudApiSender(cfg, async (url, init) => {
      calls.push([String(url), init!]);
      return Response.json({ messages: [{ id: "wamid.ABC" }] });
    });
    await expect(ok.send({ kind: "queue_near", to: "628", params: ["a", "b", "c", "d"] })).resolves.toBe(
      "wamid.ABC",
    );
    expect(calls[0]![0]).toBe("https://graph.facebook.com/v25.0/1234567890/messages");
    expect(new Headers(calls[0]![1].headers).get("authorization")).toBe("Bearer test-token");

    const refused = cloudApiSender(cfg, async () =>
      Response.json(
        { error: { message: "Recipient phone number not in allowed list", code: 131030 } },
        { status: 400 },
      ),
    );
    await expect(refused.send({ kind: "otp", to: "628", params: ["1"] })).rejects.toThrow(
      "Recipient phone number not in allowed list (kode 131030)",
    );
  });
});
