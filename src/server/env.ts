import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once on first use.
 * Values are read lazily so `next build` works without secrets.
 */
const schema = z.object({
  /** Supabase pooler URL (transaction mode, port 6543). Unset = in-memory demo database. */
  DATABASE_URL: z.url().optional(),
  /** At least 32 random bytes. `openssl rand -base64 32`. Required with a real database. */
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  /** Public origin, e.g. https://consigliere.vercel.app */
  BETTER_AUTH_URL: z.url().optional(),
  /** Xendit secret key. Unset = demo payments that never touch a gateway. */
  XENDIT_SECRET_KEY: z.string().min(1).optional(),
  /** Xendit dashboard → Webhooks → verification token. Required with a secret key. */
  XENDIT_WEBHOOK_TOKEN: z.string().min(1).optional(),
  /** "1" shows the demo ribbon and one-tap demo logins on a real database too. Always on without one. */
  DEMO_MODE: z.enum(["0", "1"]).optional(),
  /** Staff password the demo data was seeded with (SEED_STAFF_PASSWORD). */
  DEMO_STAFF_PASSWORD: z.string().min(8).optional(),
  /** Bearer token Vercel Cron sends to reset the demo data each night. */
  CRON_SECRET: z.string().min(16).optional(),
  /** WhatsApp Cloud API: a system user's permanent token. Unset (with the id) = messages are only logged. */
  WHATSAPP_TOKEN: z.string().min(1).optional(),
  /** WhatsApp Manager → phone number → "Phone number ID" (digits, not the phone number itself). */
  WHATSAPP_PHONE_NUMBER_ID: z.string().regex(/^\d+$/).optional(),
  /** Graph API version. */
  WHATSAPP_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v25.0"),
  /** Approved authentication template (copy-code button) for the forgot-PIN code. */
  WHATSAPP_TEMPLATE_OTP: z.string().min(1).default("kode_pin"),
  /** Approved utility template for "your turn is near", with four values: name, branch, how near, ticket. */
  WHATSAPP_TEMPLATE_NEAR: z.string().min(1).default("antrean_dekat"),
  /** Language code both templates were approved in. */
  WHATSAPP_TEMPLATE_LANG: z.string().min(2).default("id"),
  /** Optional: only these numbers get real messages (comma separated). Empty = everyone. */
  WHATSAPP_ALLOWLIST: z.string().optional(),
  /** Telegram @BotFather token. Unset = the Telegram channel is off. */
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^\d+:[\w-]+$/)
    .optional(),
  /** Random string Telegram sends back on every webhook call (1–256 of A-Z a-z 0-9 _ -). */
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .regex(/^[\w-]{16,256}$/)
    .optional(),
  /** "1" lets the chatbot answer with a language model; anything else uses the rule brain only. */
  CHAT_AI: z.enum(["0", "1"]).optional(),
  /** Vercel AI Gateway key. On Vercel, OIDC works without it. */
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  /** Gateway model id. */
  CHAT_MODEL: z.string().min(3).default("anthropic/claude-haiku-5.5"),
  /** Most AI answers per shop day across all chats; past it the rule brain answers. */
  CHAT_AI_DAILY_CAP: z.coerce.number().int().min(0).default(300),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** The auth secret. The demo database gets a fixed one; a real database must have its own. */
export function authSecret(): string {
  const { BETTER_AUTH_SECRET, DATABASE_URL } = env();
  if (BETTER_AUTH_SECRET) return BETTER_AUTH_SECRET;
  if (!DATABASE_URL) return "consigliere-demo-only-secret-do-not-use-in-production";
  throw new Error("BETTER_AUTH_SECRET is required when DATABASE_URL is set.");
}

/** Public demo: a ribbon on every screen, one-tap logins, and data that resets. */
export function demoMode(): boolean {
  const { DEMO_MODE, DATABASE_URL } = env();
  return DEMO_MODE === "1" || (!DATABASE_URL && DEMO_MODE !== "0");
}
