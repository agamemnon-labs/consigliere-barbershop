/**
 * `pnpm db:seed` — resets demo data in the database at DATABASE_URL_DIRECT (or DATABASE_URL).
 * `--if-empty` seeds only a database with no branches yet (the first deploy) and leaves
 * live data alone. Runs on Node's native TypeScript support; no build step.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DEMO_MEMBER_PIN } from "../demo-credentials.ts";
import * as schema from "../schema.ts";
import { seed } from "./seed.ts";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_DIRECT (or DATABASE_URL) first. See .env.example.");
  process.exit(1);
}
const staffPassword =
  process.env.SEED_STAFF_PASSWORD ?? process.env.DEMO_STAFF_PASSWORD ?? "consigliere-demo";
const ifEmpty = process.argv.includes("--if-empty");

const client = postgres(url, { max: 1 });
try {
  const db = drizzle(client, { schema, casing: "snake_case" });
  if (ifEmpty) {
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from branches`);
    if ((row?.n ?? 0) > 0) {
      console.log("Database already has data; seed skipped.");
      process.exit(0);
    }
  }
  // SEED_DEMO=0 seeds only the catalog and staff; by default you get the full public demo.
  const demo = process.env.SEED_DEMO !== "0";
  await seed(db, {
    staffPassword,
    ...(demo ? { demoQueueAt: new Date(), memberPin: DEMO_MEMBER_PIN } : {}),
  });
  console.log(
    `Seeded: 3 branches, 12 barbers, full pricelist, 14 days of rotation, 5 staff accounts${demo ? ", demo members, today's queue and four weeks of sales" : ""}.`,
  );
} finally {
  await client.end();
}
