/** What booking needs from a payment gateway. Xendit today; Midtrans could slot in. */
export interface PaymentProvider {
  readonly name: "xendit" | "demo";
  /** True when no real money can move (demo, or a gateway's test keys). */
  readonly testMode: boolean;
  /** A one-off dynamic QRIS for `amount` rupiah, tied to our `reference`. */
  createQris(input: QrisInput): Promise<QrisCharge>;
  /** Test mode only: pretend the customer scanned and paid. */
  simulatePaid(charge: { paymentId: string; reference: string; amount: number }): Promise<void>;
  /** Asks the gateway directly, for when its webhook never arrived. */
  getStatus(paymentId: string): Promise<PaymentStatus>;
}

/** What the gateway says about one charge right now. */
export type PaymentStatus =
  | { status: "paid"; amount: number | null; paidAt: Date | null }
  | { status: "pending" | "failed" | "expired" | "unknown" };

export type QrisInput = { reference: string; amount: number; expiresAt: Date; description: string };

export type QrisCharge = { paymentId: string; qrString: string };

/** A gateway's news about a payment, in our words. */
export type PaymentEvent = {
  reference: string;
  paymentId: string;
  status: "paid" | "failed";
  amount: number | null;
  /** When the customer actually paid, if the gateway says. Webhooks can arrive later than that. */
  paidAt?: Date | null;
};

export class PaymentError extends Error {
  override name = "PaymentError";
}
