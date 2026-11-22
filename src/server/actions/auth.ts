"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";
import { hasDatabase } from "@/server/env";
import { getStaff, homeFor } from "@/server/session";

export type SignInState = { error?: string; email?: string };

const input = z.object({
  email: z.email("Alamat email belum benar."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export async function signInStaff(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = input.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };
  if (!hasDatabase()) return { error: "Database belum tersambung. Isi DATABASE_URL dulu.", email };

  try {
    await auth().api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error:
          error.status === "TOO_MANY_REQUESTS"
            ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
            : "Email atau kata sandi salah.",
        email,
      };
    }
    throw error;
  }

  const staff = await getStaff();
  if (!staff) {
    await auth().api.signOut({ headers: await headers() });
    return { error: "Akun ini bukan akun staf.", email };
  }
  redirect(homeFor(staff.role));
}

export async function signOut() {
  await auth().api.signOut({ headers: await headers() });
  redirect("/staf/masuk");
}
