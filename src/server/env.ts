import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once on first use.
 * Values are read lazily so `next build` works without a database.
 */
const schema = z.object({
  /** Supabase pooler URL (transaction mode, port 6543) for the app. */
  DATABASE_URL: z.url(),
  /** At least 32 random bytes. `openssl rand -base64 32` */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Public origin, e.g. https://consigliere.vercel.app */
  BETTER_AUTH_URL: z.url().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** True when the app has a database to talk to. Pages use it to show a calm notice instead of crashing. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
