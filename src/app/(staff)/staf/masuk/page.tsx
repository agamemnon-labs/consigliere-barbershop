import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Masuk staf", robots: { index: false } };

export default function StaffSignIn() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <Wordmark size="lg" />
      <div className="mt-8 rounded-3xl border border-rule bg-surface p-6">
        <p className="label">Ruang staf</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight">Selamat bekerja</h1>
        <SignInForm />
      </div>
    </main>
  );
}
