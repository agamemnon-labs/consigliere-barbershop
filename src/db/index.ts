import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect(url: string) {
  // Supabase's transaction pooler does not support prepared statements.
  const client = postgres(url, { prepare: false, max: 5 });
  return drizzle(client, { schema, casing: "snake_case" });
}

/**
 * The app's database type. The demo database (PGlite) exposes the same Drizzle
 * query API, so it is typed as this too.
 */
export type Database = ReturnType<typeof connect>;

const globalForDb = globalThis as unknown as { db?: Promise<Database> };

/** True when no real database is configured and the in-memory demo is used. */
export function isDemoDatabase(): boolean {
  return !process.env.DATABASE_URL;
}

/** Lazily created, reused across hot reloads and warm invocations. */
export function getDb(): Promise<Database> {
  globalForDb.db ??= create();
  return globalForDb.db;
}

async function create(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url) return connect(url);
  console.warn("[consigliere] DATABASE_URL is not set: using the in-memory demo database.");
  const { createDemoDb } = await import("./demo");
  return (await createDemoDb()) as unknown as Database;
}

export { schema };
