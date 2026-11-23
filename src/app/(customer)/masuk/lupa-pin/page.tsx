import type { Metadata } from "next";
import { Screen } from "@/components/screen";
import { ResetPinForm } from "./reset-form";

export const metadata: Metadata = { title: "Lupa PIN", robots: { index: false } };

export default function ForgotPinPage() {
  return (
    <Screen back={{ href: "/masuk", label: "Masuk" }}>
      <h1 className="text-[2rem] leading-tight">Lupa PIN</h1>
      <p className="mt-2 text-muted">
        Kami kirim kode 6 angka ke WhatsApp-mu. Kasir tidak akan pernah memintanya.
      </p>
      <div className="mt-6">
        <ResetPinForm />
      </div>
    </Screen>
  );
}
