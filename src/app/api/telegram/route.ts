import { getDb } from "@/db";
import { ask } from "@/server/chat/answer";
import { siteOrigin } from "@/server/chat/origin";
import { readUpdate, replyBody, secretMatches } from "@/server/chat/telegram";
import { env } from "@/server/env";

/**
 * Telegram webhook. A wrong or missing secret gets 401; anything else gets 200 so
 * Telegram stops retrying, with our reply as a `sendMessage` body when there is one.
 */
export async function POST(request: Request) {
  const { TELEGRAM_WEBHOOK_SECRET: secret, TELEGRAM_BOT_TOKEN: token } = env();
  if (!secret || !token) return new Response("Telegram is not configured", { status: 503 });
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const message = readUpdate(await request.json().catch(() => null));
  if (!message) return Response.json({ ok: true });

  const answer = await ask(await getDb(), {
    channel: "telegram",
    chatId: message.chatId,
    text: message.text,
    now: new Date(),
    siteUrl: siteOrigin(request),
  });
  return Response.json(replyBody(message.chatId, answer.text));
}
