import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

function create() {
  // Supabase's transaction pooler does not support prepared statements.
  const client = postgres(env().DATABASE_URL, { prepare: false, max: 5 });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof create>;

const globalForDb = globalThis as unknown as { db?: Database };

/** Lazily created, reused across hot reloads and warm invocations. */
export function db(): Database {
  globalForDb.db ??= create();
  return globalForDb.db;
}

export { schema };
