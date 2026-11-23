import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Credits } from "@/components/credits";
import { getDb } from "@/db";
import { requireMemberUserId } from "@/server/session";
import { topupPackages } from "@/server/topup";
import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Isi saldo", robots: { index: false } };

/** Member tops up from the phone: pick a package, pay by QRIS. */
export default function TopupPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-6 pt-[calc(1rem+env(safe-area-inset-top))]">
      <BackLink href="/kartu">Kartu member</BackLink>
      <header className="pt-10 pb-8">
        <p className="label">Saldo member</p>
        <h1 className="mt-3 text-5xl leading-[1.05]">Isi saldo</h1>
        <p className="mt-4 text-muted">Bayar QRIS, saldo langsung masuk</p>
      </header>
      <Suspense fallback={<p className="py-10 text-muted">Memuat paket…</p>}>
        <Packages />
      </Suspense>
      <Credits />
    </div>
  );
}

async function Packages() {
  await requireMemberUserId();
  const packages = await topupPackages(await getDb());
  if (packages.length === 0)
    return <p className="text-muted">Belum ada paket top-up. Tanyakan ke kasir, ya.</p>;
  return <TopupForm packages={packages.map((p) => ({ id: p.id, pay: p.pay, get: p.get }))} />;
}
