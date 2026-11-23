import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { DEMO_MEMBER_PIN, DEMO_STAFF_PASSWORD } from "@/db/demo-credentials";
import { seed } from "@/db/seed/seed";
import { demoMode, env } from "@/server/env";

/**
 * Vercel Cron, nightly: puts the public demo back to a fresh day so visitors
 * always find a queue, two weeks of rotation and four weeks of sales.
 * Only in demo mode, and only with the cron secret.
 */
export async function GET(request: Request) {
  const { CRON_SECRET, DEMO_STAFF_PASSWORD: password } = env();
  if (!demoMode() || !CRON_SECRET) return new Response("Not found", { status: 404 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  await seed(await getDb(), {
    staffPassword: password ?? DEMO_STAFF_PASSWORD,
    demoQueueAt: new Date(),
    memberPin: DEMO_MEMBER_PIN,
  });
  return Response.json({ result: "reset" });
}
