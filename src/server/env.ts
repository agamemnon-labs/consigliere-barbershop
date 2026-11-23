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
