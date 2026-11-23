/**
 * `pnpm db:seed` — resets demo data in the database at DATABASE_URL_DIRECT (or DATABASE_URL).
 * Runs on Node's native TypeScript support; no build step.
 */
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
const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "consigliere-demo";

const client = postgres(url, { max: 1 });
try {
  // SEED_DEMO=0 seeds only the catalog and staff; by default you get the full public demo.
  const demo = process.env.SEED_DEMO !== "0";
  await seed(drizzle(client, { schema, casing: "snake_case" }), {
    staffPassword,
    ...(demo ? { demoQueueAt: new Date(), memberPin: DEMO_MEMBER_PIN } : {}),
  });
  console.log(
    `Seeded: 3 branches, 12 barbers, full pricelist, 14 days of rotation, 5 staff accounts${demo ? ", demo members, today's queue and four weeks of sales" : ""}.`,
  );
} finally {
  await client.end();
}
