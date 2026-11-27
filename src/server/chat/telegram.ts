import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/*
 * Telegram channel. Telegram calls our webhook with each update; we answer the
 * message in the webhook's own response (a `sendMessage` method body), so a normal
 * reply needs no outbound call at all. Only private text messages are answered.
 */

export type TelegramMessage = { chatId: string; text: string };

/** The one message worth answering in an update, or null. Exported for tests. */
export function readUpdate(update: unknown): TelegramMessage | null {
  if (!update || typeof update !== "object") return null;
  const message = (update as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const m = message as { text?: unknown; chat?: { id?: unknown; type?: unknown } };
  if (typeof m.text !== "string" || !m.chat || m.chat.type !== "private") return null;
  if (typeof m.chat.id !== "number" && typeof m.chat.id !== "string") return null;
  // "/start" is what Telegram sends when someone opens the bot for the first time.
  const text = m.text.startsWith("/start") ? "halo" : m.text;
  return { chatId: String(m.chat.id), text };
}

/** Constant-time check of the X-Telegram-Bot-Api-Secret-Token header. */
export function secretMatches(header: string | null, expected: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The webhook response body that makes Telegram send our reply. */
export function replyBody(chatId: string, text: string) {
  return { method: "sendMessage", chat_id: chatId, text, link_preview_options: { is_disabled: true } };
}

export function telegramConfigured(): boolean {
  const e = env();
  return Boolean(e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_WEBHOOK_SECRET);
}

export class TelegramError extends Error {
  override name = "TelegramError";
}

async function call<T>(method: string, body: object, fetchImpl: typeof fetch = fetch): Promise<T> {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN belum diisi.");
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: T;
    description?: string;
  } | null;
  if (!json?.ok) throw new TelegramError(json?.description ?? `Telegram menjawab ${res.status}`);
  return json.result as T;
}

/** Points the bot at this deployment's webhook. Safe to run again. */
export async function connectWebhook(origin: string, fetchImpl?: typeof fetch): Promise<string> {
  const secret = env().TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new TelegramError("TELEGRAM_WEBHOOK_SECRET belum diisi.");
  const url = `${origin}/api/telegram`;
  if (!url.startsWith("https://")) throw new TelegramError("Telegram butuh alamat https.");
  await call(
    "setWebhook",
    { url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true },
    fetchImpl,
  );
  return url;
}

export type WebhookStatus = {
  url: string;
  pending: number;
  lastError: string | null;
  username: string | null;
};

/** What Telegram has on file for the bot, or null when the bot isn't configured. */
export async function webhookStatus(fetchImpl?: typeof fetch): Promise<WebhookStatus | null> {
  if (!env().TELEGRAM_BOT_TOKEN) return null;
  const [info, me] = await Promise.all([
    call<{ url: string; pending_update_count: number; last_error_message?: string }>(
      "getWebhookInfo",
      {},
      fetchImpl,
    ),
    call<{ username?: string }>("getMe", {}, fetchImpl),
  ]);
  return {
    url: info.url,
    pending: info.pending_update_count,
    lastError: info.last_error_message ?? null,
    username: me.username ?? null,
  };
}
