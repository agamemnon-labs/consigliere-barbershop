import "server-only";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { type Database, schema as s } from "@/db";
import { ruleReply, type ShopFacts } from "@/domain/chat";
import { shopDate, shopDayStart } from "@/domain/time";
import { env } from "@/server/env";
import { aiEnabled, aiReply, type Turn } from "./ai";
import { shopFacts } from "./facts";

/*
 * The one brain every channel asks. A channel adapter (web chat, Telegram, later
 * WhatsApp from PR 29) only turns its own message format into `ask` and sends the
 * text back. Rules always work; the AI brain is used when it is switched on, under
 * its daily cap, and falls back to the rules on any error.
 */

export type Channel = "web" | "telegram" | "whatsapp";
export type Answer = { text: string; brain: "rules" | "ai" | "limit" };

export const MAX_MESSAGE_LENGTH = 500;
/** Messages one chat may send in a shop day. */
export const DAILY_LIMIT_PER_CHAT = 40;
const HISTORY_TURNS = 6;

export type AskOptions = {
  /** Swappable for tests: the AI call, or null to force the rule brain. */
  ai?: ((facts: ShopFacts, history: Turn[], text: string) => Promise<string>) | null;
};

export async function ask(
  db: Database,
  input: { channel: Channel; chatId: string; text: string; now: Date; siteUrl: string },
  options: AskOptions = {},
): Promise<Answer> {
  const text = input.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  const where = and(eq(s.chatMessages.channel, input.channel), eq(s.chatMessages.chatId, input.chatId));
  const dayStart = shopDayStart(shopDate(input.now));

  const [sentToday] = await db
    .select({ n: count() })
    .from(s.chatMessages)
    .where(and(where, eq(s.chatMessages.role, "user"), gte(s.chatMessages.createdAt, dayStart)));
  if ((sentToday?.n ?? 0) >= DAILY_LIMIT_PER_CHAT) {
    return {
      text: "Hari ini chat-nya sudah banyak banget. Lanjut besok ya, atau cek langsung harga dan antrean di situs.",
      brain: "limit",
    };
  }

  const facts = await shopFacts(db, input.now, input.siteUrl);
  const ai = options.ai === undefined ? (aiEnabled() ? aiReply : null) : options.ai;

  let answer: Answer = { text: ruleReply(text, facts), brain: "rules" };
  if (ai && text && (await aiUsedToday(db, dayStart)) < env().CHAT_AI_DAILY_CAP) {
    const history = await recentTurns(db, input.channel, input.chatId);
    try {
      answer = { text: await ai(facts, history, text), brain: "ai" };
    } catch (error) {
      console.warn("Chat AI failed, answering with rules", error);
    }
  }

  await db.insert(s.chatMessages).values([
    { channel: input.channel, chatId: input.chatId, role: "user", body: text, createdAt: input.now },
    {
      channel: input.channel,
      chatId: input.chatId,
      role: "bot",
      body: answer.text,
      brain: answer.brain,
      createdAt: new Date(input.now.getTime() + 1),
    },
  ]);
  return answer;
}

async function aiUsedToday(db: Database, dayStart: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(s.chatMessages)
    .where(and(eq(s.chatMessages.brain, "ai"), gte(s.chatMessages.createdAt, dayStart)));
  return row?.n ?? 0;
}

async function recentTurns(db: Database, channel: Channel, chatId: string): Promise<Turn[]> {
  const rows = await db
    .select({ role: s.chatMessages.role, body: s.chatMessages.body })
    .from(s.chatMessages)
    .where(and(eq(s.chatMessages.channel, channel), eq(s.chatMessages.chatId, chatId)))
    .orderBy(desc(s.chatMessages.createdAt))
    .limit(HISTORY_TURNS);
  return rows.reverse().map((r) => ({ role: r.role === "user" ? "user" : "bot", text: r.body }));
}

/** The latest chat lines across channels, newest first, for Admin → Chat. */
export async function recentChats(db: Database, limit = 80) {
  return db
    .select({
      id: s.chatMessages.id,
      channel: s.chatMessages.channel,
      chatId: s.chatMessages.chatId,
      role: s.chatMessages.role,
      body: s.chatMessages.body,
      brain: s.chatMessages.brain,
      createdAt: s.chatMessages.createdAt,
    })
    .from(s.chatMessages)
    .orderBy(desc(s.chatMessages.createdAt))
    .limit(limit);
}
