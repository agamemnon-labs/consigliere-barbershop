import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect(url: string) {
  const client = postgres(url, {
    // Supabase's transaction pooler (Supavisor, port 6543) does not support prepared statements,
    // and it hangs on pipelined queries: the answers never arrive and every page on that
    // function instance waits until Vercel kills it. One query in flight per connection.
    prepare: false,
    max_pipeline: 1,
    max: 5,
    // A pooler that goes silent must fail the query, not hang the page.
    connect_timeout: 10,
    query_timeout: 20,
    // Serverless instances sleep between requests; don't wake up on a dead socket.
    idle_timeout: 20,
    max_lifetime: 60 * 5,
  });
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
