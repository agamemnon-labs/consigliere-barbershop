import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { env } from "@/server/env";
import { paymentProvider } from "@/server/payments";
import { reconcileRecent } from "@/server/reconcile";

/**
 * Vercel Cron: asks the gateway about the last day's unpaid QRIS charges and
 * settles any that were paid but whose webhook never arrived. Pages already do
 * this for a charge as it expires; this catches the ones nobody reopened.
 */
export async function GET(request: Request) {
  const { CRON_SECRET } = env();
  if (!CRON_SECRET) return new Response("Not found", { status: 404 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${CRON_SECRET}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await reconcileRecent(await getDb(), paymentProvider(), new Date());
  return Response.json({ result });
}
