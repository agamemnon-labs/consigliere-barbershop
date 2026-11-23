import { beforeAll, describe, expect, it } from "vitest";
import { createDemoDb } from "@/db/demo";
import { createAuth } from "./auth";

let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
  const db = await createDemoDb({ staffPassword: "correct horse battery", from: "2026-11-22", days: 1 });
  auth = createAuth(db, { secret: "x".repeat(32), baseURL: "http://localhost:3000" });
}, 60_000);

describe("staff auth against the real schema", () => {
  it("signs a seeded cashier in and exposes role and branch", async () => {
    const res = await auth.api.signInEmail({
      body: { email: "kasir.kalimantan@consigliere.test", password: "correct horse battery" },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("consigliere.session_token");

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.role).toBe("cashier");
    expect(session?.user.branchId).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    await expect(
      auth.api.signInEmail({ body: { email: "owner@consigliere.test", password: "nope nope nope" } }),
    ).rejects.toThrow();
  });

  it("does not allow public sign-up", async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: "x@y.test", password: "long enough password", name: "X" } }),
    ).rejects.toThrow();
  });
});

describe("member auth", () => {
  it("signs a member in with phone number and PIN", async () => {
    const res = await auth.api.signInPhoneNumber({
      body: { phoneNumber: "6281200000001", password: "482913" },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: res.headers.get("set-cookie") ?? "" }),
    });
    expect(session?.user.role).toBe("member");
  });

  it("rejects a wrong PIN", async () => {
    await expect(
      auth.api.signInPhoneNumber({ body: { phoneNumber: "6281200000001", password: "000001" } }),
    ).rejects.toThrow();
  });
});
