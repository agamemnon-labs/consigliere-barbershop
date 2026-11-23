import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PaymentError, type PaymentEvent, type PaymentProvider, type PaymentStatus } from "./types";

/**
 * Xendit Payments API v3 (api-version 2024-11-11): one-off QRIS payment
 * requests, test-mode simulation, and the `payment.*` webhooks.
 * https://docs.xendit.co/apidocs/create-payment-request
 */
const API = "https://api.xendit.co/v3/payment_requests";
const REFUNDS = "https://api.xendit.co/v3/refunds";
const VERSION = "2024-11-11";

const created = z.object({
  payment_request_id: z.string(),
  actions: z
    .array(z.object({ type: z.string().optional(), descriptor: z.string().optional(), value: z.string() }))
    .default([]),
});

export function xenditProvider(secretKey: string): PaymentProvider {
  const headers = {
    authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
    "api-version": VERSION,
    "content-type": "application/json",
  };

  async function call(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // A page waits on some of these calls; never let a slow gateway hang it.
      signal: AbortSignal.timeout(8_000),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message = z.object({ message: z.string() }).safeParse(json);
      throw new PaymentError(
        `Xendit ${res.status}: ${message.success ? message.data.message : "no message"}`,
      );
    }
    return json;
  }

  return {
    name: "xendit",
    testMode: secretKey.startsWith("xnd_development_"),

    async createQris({ reference, amount, expiresAt, description }) {
      const json = await call(API, {
        reference_id: reference,
        type: "PAY",
        country: "ID",
        currency: "IDR",
        request_amount: amount,
        capture_method: "AUTOMATIC",
        channel_code: "QRIS",
        channel_properties: { expires_at: expiresAt.toISOString() },
        description,
      });
      const parsed = created.parse(json);
      const qr = parsed.actions.find((a) => a.descriptor === "QR_STRING") ?? parsed.actions[0];
      if (!qr) throw new PaymentError("Xendit did not return a QR string.");
      return { paymentId: parsed.payment_request_id, qrString: qr.value };
    },

    async simulatePaid({ paymentId, amount }) {
      if (!this.testMode) throw new PaymentError("Simulation is only for test keys.");
      // The result arrives later as a `payment.capture` webhook.
      await call(`${API}/${paymentId}/simulate`, { amount });
    },

    async getStatus(paymentId) {
      const json = await call(`${API}/${encodeURIComponent(paymentId)}`);
      return statusOf(requestStatus.parse(json));
    },

    async refund({ paymentId, reference, amount }) {
      // Refunds name the payment (py-…), not the payment request (pr-…) we keep.
      const request = z
        .object({ latest_payment_id: z.string().nullish() })
        .parse(await call(`${API}/${encodeURIComponent(paymentId)}`));
      if (!request.latest_payment_id) throw new PaymentError("Xendit has no payment to refund.");
      const json = await call(REFUNDS, {
        reference_id: `refund-${reference}`,
        payment_id: request.latest_payment_id,
        amount,
        reason: "CANCELLATION",
      });
      const refund = z.object({ refund_id: z.string(), status: z.string() }).parse(json);
      if (refund.status === "FAILED") throw new PaymentError("Xendit refused the refund.");
      return refund.refund_id;
    },
  };
}

const requestStatus = z.object({
  status: z.string(),
  request_amount: z.number().optional(),
  updated: z.string().optional(),
});

/** Payment request statuses: ACCEPTING_PAYMENTS, REQUIRES_ACTION, AUTHORIZED, CANCELED, EXPIRED, SUCCEEDED, FAILED. */
function statusOf(pr: z.infer<typeof requestStatus>): PaymentStatus {
  switch (pr.status) {
    case "SUCCEEDED":
      return { status: "paid", amount: pr.request_amount ?? null, paidAt: when(pr.updated) };
    case "EXPIRED":
    case "CANCELED":
      return { status: "expired" };
    case "FAILED":
      return { status: "failed" };
    default:
      return { status: "pending" };
  }
}

function when(iso: string | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

const webhook = z.object({
  event: z.string(),
  data: z.object({
    reference_id: z.string(),
    payment_request_id: z.string(),
    status: z.string(),
    request_amount: z.number().optional(),
    captures: z.array(z.object({ capture_timestamp: z.string().optional() })).optional(),
    updated: z.string().optional(),
  }),
});

/**
 * Reads a Xendit webhook. Returns null for events we don't act on.
 * Throws when the callback token is wrong, so the route can answer 401.
 */
export function readXenditWebhook(
  token: string | null,
  body: unknown,
  expected: string,
): PaymentEvent | null {
  if (!token || !sameSecret(token, expected)) throw new PaymentError("Bad callback token.");
  const parsed = webhook.safeParse(body);
  if (!parsed.success) return null;
  const { event, data } = parsed.data;
  const status =
    event === "payment.capture" && data.status === "SUCCEEDED"
      ? "paid"
      : event === "payment.failure"
        ? "failed"
        : null;
  if (!status) return null;
  return {
    reference: data.reference_id,
    paymentId: data.payment_request_id,
    status,
    amount: data.request_amount ?? null,
    paidAt: status === "paid" ? when(data.captures?.[0]?.capture_timestamp ?? data.updated) : null,
  };
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
