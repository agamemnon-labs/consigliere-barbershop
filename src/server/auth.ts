import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { env } from "@/server/env";

export const STAFF_ROLES = ["cashier", "admin", "owner"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type Role = "member" | StaffRole;

function create() {
  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = env();
  return betterAuth({
    appName: "Consigliere",
    secret: BETTER_AUTH_SECRET,
    ...(BETTER_AUTH_URL ? { baseURL: BETTER_AUTH_URL } : {}),
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.rateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Staff accounts are created by the owner, never by sign-up.
      disableSignUp: true,
      minPasswordLength: 10,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          input: false,
          required: true,
          defaultValue: "member",
        },
        branchId: { type: "string", input: false, required: false },
        isActive: {
          type: "boolean",
          input: false,
          required: true,
          defaultValue: true,
        },
      },
    },
    session: {
      // A cashier's shift is long; a week keeps the counter PC signed in without surprises.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "consigliere",
      database: { generateId: "uuid" },
    },
    telemetry: { enabled: false },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof create>;

let instance: Auth | undefined;

/** Created on first use so builds and static pages never need database credentials. */
export function auth(): Auth {
  instance ??= create();
  return instance;
}
