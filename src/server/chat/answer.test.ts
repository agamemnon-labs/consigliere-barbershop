import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createDemoDb } from "@/db/demo";
import * as s from "@/db/schema";
import { ask, DAILY_LIMIT_PER_CHAT } from "./answer";
import { shopFacts } from "./facts";

const DAY = "2026-11-23";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+08:00`);
const site = "https://consigliere.test";
let db: Database;

beforeAll(async () => {
  db = (await createDemoDb({ from: DAY, days: 1, staffPassword: "x".repeat(12) })) as unknown as Database;
}, 60_000);

describe("shopFacts", () => {
  it("reads the shop's own prices, branches, rotation and member rules", async () => {
    const facts = await shopFacts(db, at("14:00"), site);
    expect(facts.levels.map((l) => l.price)).toEqual([80_000, 95_000, 110_000, 125_000]);
    expect(facts.services.find((x) => x.slug === "haircut")?.price).toBe("80K–125K");
    expect(facts.branches.map((b) => b.slug).sort()).toEqual(["belatuk", "citra-niaga", "pulau-kalimantan"]);
    expect(facts.branches.some((b) => b.barbers.length > 0)).toBe(true);
    expect(facts.barbers.find((b) => b.name === "Vito")?.week).toHaveLength(7);
    expect(facts.membership.fee).toBe(30_000);
  });
});

describe("ask", () => {
  it("answers with the rule brain and logs both sides", async () => {
    const answer = await ask(
      db,
      { channel: "web", chatId: "chat-rules", text: "harga cukur berapa?", now: at("14:00"), siteUrl: site },
      { ai: null },
    );
    expect(answer.brain).toBe("rules");
    expect(answer.text).toContain("Regular 80K");
    const rows = await db.select().from(s.chatMessages).where(eq(s.chatMessages.chatId, "chat-rules"));
    expect(rows.map((r) => r.role).sort()).toEqual(["bot", "user"]);
  });

  it("uses the AI brain with recent history when it is on", async () => {
    let seen: { history: number; text: string } | null = null;
    const ai = async (_f: unknown, history: unknown[], text: string) => {
      seen = { history: history.length, text };
      return "Jawaban AI";
    };
    const input = { channel: "telegram" as const, chatId: "chat-ai", now: at("14:00"), siteUrl: site };
    await ask(db, { ...input, text: "halo" }, { ai });
    const answer = await ask(db, { ...input, text: "antre belatuk?", now: at("14:01") }, { ai });
    expect(answer).toEqual({ text: "Jawaban AI", brain: "ai" });
    expect(seen).toEqual({ history: 2, text: "antre belatuk?" });
  });

  it("falls back to the rules when the AI fails", async () => {
    const answer = await ask(
      db,
      { channel: "web", chatId: "chat-fail", text: "member gimana", now: at("14:00"), siteUrl: site },
      {
        ai: async () => {
          throw new Error("gateway down");
        },
      },
    );
    expect(answer.brain).toBe("rules");
    expect(answer.text).toContain("Daftar member 30K");
  });

  it("stops a chat that has sent too much today", async () => {
    await db.insert(s.chatMessages).values(
      Array.from({ length: DAILY_LIMIT_PER_CHAT }, () => ({
        channel: "web",
        chatId: "chat-busy",
        role: "user",
        body: "x",
        createdAt: at("10:00"),
      })),
    );
    const answer = await ask(
      db,
      { channel: "web", chatId: "chat-busy", text: "halo", now: at("14:00"), siteUrl: site },
      { ai: null },
    );
    expect(answer.brain).toBe("limit");
  });
});
