import { describe, expect, it, vi } from "vitest";

import { readXenditWebhook, xenditProvider } from "./xendit";

const capture = {
  event: "payment.capture",
  business_id: "biz",
  created: "2026-11-23T06:00:00Z",
  data: {
    payment_id: "py-1",
    payment_request_id: "pr-1",
    reference_id: "booking-1",
    status: "SUCCEEDED",
    request_amount: 125000,
    channel_code: "QRIS",
  },
};

describe("readXenditWebhook", () => {
  it("turns a capture into a paid event", () => {
    expect(readXenditWebhook("tok", capture, "tok")).toEqual({
      reference: "booking-1",
      paymentId: "pr-1",
      status: "paid",
      amount: 125000,
    });
  });

  it("rejects a wrong or missing token", () => {
    expect(() => readXenditWebhook("nope", capture, "tok")).toThrow();
    expect(() => readXenditWebhook(null, capture, "tok")).toThrow();
  });

  it("ignores events we don't act on", () => {
    expect(readXenditWebhook("tok", { ...capture, event: "payment.authorization" }, "tok")).toBeNull();
    expect(readXenditWebhook("tok", { hello: "world" }, "tok")).toBeNull();
  });
});

describe("xenditProvider", () => {
  it("creates a QRIS payment request and reads the QR string", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        payment_request_id: "pr-9",
        status: "REQUIRES_ACTION",
        actions: [{ type: "PRESENT_TO_CUSTOMER", descriptor: "QR_STRING", value: "00020101..." }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const xendit = xenditProvider("xnd_development_abc");
    const charge = await xendit.createQris({
      reference: "b-1",
      amount: 80000,
      expiresAt: new Date("2026-11-23T06:15:00Z"),
      description: "Haircut",
    });
    expect(charge).toEqual({ paymentId: "pr-9", qrString: "00020101..." });
    expect(xendit.testMode).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.xendit.co/v3/payment_requests");
    expect((init.headers as Record<string, string>)["api-version"]).toBe("2024-11-11");
    expect(JSON.parse(init.body as string)).toMatchObject({
      reference_id: "b-1",
      channel_code: "QRIS",
      request_amount: 80000,
      currency: "IDR",
    });
    vi.unstubAllGlobals();
  });
});
