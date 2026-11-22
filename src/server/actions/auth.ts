"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/server/auth";
import { homeFor, isStaffRole } from "@/server/session";

const WRONG = "Email atau kata sandi salah.";

export type SignInState = { error?: string; email?: string };

const input = z.object({
  email: z.email("Alamat email belum benar."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export async function signInStaff(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = input.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  // Only staff may sign in here. Members get their own phone + PIN login (phase 6).
  const db = await getDb();
  const [user] = await db
    .select({ role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()));
  const role = user?.isActive ? user.role : undefined;
  if (!role || !isStaffRole(role)) return { error: WRONG, email };

  try {
    await (await auth()).api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error:
          error.status === "TOO_MANY_REQUESTS"
            ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
            : WRONG,
        email,
      };
    }
    throw error;
  }

  redirect(homeFor(role));
}

export async function signOut() {
  await (await auth()).api.signOut({ headers: await headers() });
  redirect("/staf/masuk");
}
