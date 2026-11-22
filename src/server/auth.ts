import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { type Database, getDb, schema } from "@/db";
import { authSecret, env } from "@/server/env";

export const STAFF_ROLES = ["cashier", "admin", "owner"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type Role = "member" | StaffRole;

type Options = { secret: string; baseURL?: string | undefined };

/** Builds the auth instance for any Drizzle Postgres database (postgres.js in the app, PGlite in tests). */
export function createAuth(
  database: Database | Parameters<typeof drizzleAdapter>[0],
  { secret, baseURL }: Options,
) {
  return betterAuth({
    appName: "Consigliere",
    secret,
    ...(baseURL ? { baseURL } : {}),
    database: drizzleAdapter(database, {
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

export type Auth = ReturnType<typeof createAuth>;

let instance: Promise<Auth> | undefined;

/** Created on first use so builds and static pages never need a database or secrets. */
export function auth(): Promise<Auth> {
  instance ??= getDb().then((db) => createAuth(db, { secret: authSecret(), baseURL: env().BETTER_AUTH_URL }));
  return instance;
}
