"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_MEMBER_PIN, DEMO_STAFF_PASSWORD } from "@/db/demo-credentials";
import { auth } from "@/server/auth";
import { demoMode, env } from "@/server/env";

const STAFF = {
  owner: { email: "owner@consigliere.test", home: "/admin" },
  cashier: { email: "kasir.juanda@consigliere.test", home: "/kasir" },
} as const;

/** Public demo only: sign in as a demo account with one tap. */
export async function demoSignIn(as: "owner" | "cashier" | "member") {
  if (!demoMode()) redirect("/");
  const api = (await auth()).api;
  const h = await headers();
  await api.signOut({ headers: h }).catch(() => undefined);
  if (as === "member") {
    await api.signInPhoneNumber({
      body: { phoneNumber: "6281200000002", password: DEMO_MEMBER_PIN },
      headers: h,
    });
    redirect("/kartu");
  }
  const who = STAFF[as];
  await api.signInEmail({
    body: { email: who.email, password: env().DEMO_STAFF_PASSWORD ?? DEMO_STAFF_PASSWORD },
    headers: h,
  });
  redirect(who.home);
}
