import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { seed } from "@/db/seed/seed";
import { createAuth } from "./auth";

const client = new PGlite();
const db = drizzle(client, { schema, casing: "snake_case" });
const auth = createAuth(db, { secret: "x".repeat(32), baseURL: "http://localhost:3000" });

beforeAll(async () => {
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await client.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  await seed(db, { staffPassword: "correct horse battery", from: "2026-11-22", days: 1 });
}, 60_000);

describe("staff auth against the real schema", () => {
  it("signs a seeded cashier in and exposes role and branch", async () => {
    const res = await auth.api.signInEmail({
      body: { email: "kasir.juanda@consigliere.test", password: "correct horse battery" },
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
