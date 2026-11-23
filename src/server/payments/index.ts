import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/server/env";
import type { PaymentProvider } from "./types";
import { xenditProvider } from "./xendit";

export * from "./types";

/**
 * Demo payments: a QR that encodes nothing payable, and a "simulate" that the
 * booking module settles directly. Used whenever no gateway key is set.
 */
export const demoProvider: PaymentProvider = {
  name: "demo",
  testMode: true,
  async createQris({ reference, amount }) {
    return {
      paymentId: `demo-${randomUUID()}`,
      qrString: `CONSIGLIERE-DEMO|${reference}|IDR${amount}|TIDAK-BISA-DIBAYAR`,
    };
  },
  async simulatePaid() {
    // Settled by the caller: there is no gateway to send a webhook.
  },
  async getStatus() {
    return { status: "unknown" };
  },
  async refund({ reference }) {
    return `demo-refund-${reference}`;
  },
};

export function paymentProvider(): PaymentProvider {
  const key = env().XENDIT_SECRET_KEY;
  return key ? xenditProvider(key) : demoProvider;
}
