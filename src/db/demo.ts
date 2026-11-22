/**
 * In-memory Postgres (PGlite) with the real migrations and the demo seed.
 * Used when no DATABASE_URL is set: local dev without Supabase, CI e2e, and
 * tests. Data resets whenever the process restarts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.ts";
import { seed } from "./seed/seed.ts";

export const DEMO_STAFF_PASSWORD = "consigliere-demo";
/** PIN for the demo members (Bram 0812-0000-0001, Rizal 0812-0000-0002). */
export const DEMO_MEMBER_PIN = "482913";

export async function createDemoDb(options: { from?: string; days?: number; staffPassword?: string } = {}) {
  const client = new PGlite();
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await client.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  const db = drizzle(client, { schema, casing: "snake_case" });
  await seed(db, {
    staffPassword: options.staffPassword ?? DEMO_STAFF_PASSWORD,
    demoQueueAt: new Date(),
    memberPin: DEMO_MEMBER_PIN,
    ...options,
  });
  return db;
}
