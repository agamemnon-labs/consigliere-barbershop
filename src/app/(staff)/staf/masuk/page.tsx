import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Masuk staf", robots: { index: false } };

export default function StaffSignIn() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <div className="flex justify-center">
        <Wordmark size="lg" />
      </div>
      <div className="mt-16">
        <p className="label">Ruang staf</p>
        <h1 className="mt-3 text-4xl">Selamat bekerja.</h1>
        <p className="mt-3 text-muted">Kasir, admin, dan pemilik masuk di sini.</p>
      </div>
      <SignInForm />
    </main>
  );
}
