import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { ResetPinForm } from "./reset-form";

export const metadata: Metadata = { title: "Lupa PIN", robots: { index: false } };

export default function ForgotPinPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/masuk">Masuk</BackLink>
      <header className="pt-10 pb-8">
        <p className="label">Kartu member</p>
        <h1 className="mt-3 text-5xl leading-[1.05]">Lupa PIN.</h1>
        <p className="mt-4 text-muted">
          Kami kirim kode 6 angka ke WhatsApp-mu. Kode itu hanya untukmu: kasir tidak akan pernah memintanya.
        </p>
      </header>
      <ResetPinForm />
      <Credits />
    </div>
  );
}
