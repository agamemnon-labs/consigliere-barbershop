import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { getDb } from "@/db";
import { requireMemberUserId } from "@/server/session";
import { topupPackages } from "@/server/topup";
import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Isi saldo", robots: { index: false } };

/** Member tops up from the phone: pick a package, pay by QRIS. */
export default function TopupPage() {
  return (
    <Screen back={{ href: "/kartu", label: "Kartu member" }}>
      <h1 className="text-[2rem] leading-tight">Isi saldo</h1>
      <p className="mt-2 text-muted">
        Bayar pakai QRIS, saldo langsung masuk. Makin besar, makin banyak bonusnya
      </p>
      <div className="mt-5">
        <Suspense fallback={<div aria-busy className="h-60 rounded-2xl bg-sunk" />}>
          <Packages />
        </Suspense>
      </div>
    </Screen>
  );
}

async function Packages() {
  await requireMemberUserId();
  const packages = await topupPackages(await getDb());
  if (packages.length === 0) return <Notice title="Belum ada paket">Tanyakan ke kasir, ya.</Notice>;
  return <TopupForm packages={packages.map((p) => ({ id: p.id, pay: p.pay, get: p.get }))} />;
}
