import { getDb } from "@/db";
import { settlePayment } from "@/server/booking";
import { env } from "@/server/env";
import { PaymentError } from "@/server/payments";
import { readXenditWebhook } from "@/server/payments/xendit";

/**
 * Xendit payment webhooks. The only way an online booking becomes paid.
 * Answers 200 for anything we read, so Xendit stops retrying; 401 for a bad token.
 */
export async function POST(request: Request) {
  const expected = env().XENDIT_WEBHOOK_TOKEN;
  if (!expected) return new Response("Webhook token is not configured", { status: 503 });

  let event: ReturnType<typeof readXenditWebhook>;
  try {
    event = readXenditWebhook(request.headers.get("x-callback-token"), await request.json(), expected);
  } catch (error) {
    if (error instanceof PaymentError) return new Response("Unauthorized", { status: 401 });
    return new Response("Bad request", { status: 400 });
  }
  if (!event) return Response.json({ result: "ignored" });

  const result = await settlePayment(await getDb(), event, new Date());
  return Response.json({ result });
}
