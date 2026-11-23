"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/button";
import { Choice } from "@/components/choice";
import { Notice } from "@/components/notice";
import { formatRupiah, formatShort } from "@/domain/money";
import { startTopup, type TopupState } from "@/server/actions/topup";

type Package = { id: string; pay: number; get: number };

export function TopupForm({ packages }: { packages: Package[] }) {
  const [state, action, pending] = useActionState<TopupState, FormData>(startTopup, {});
  const [picked, setPicked] = useState(packages[0]?.id);
  const pkg = packages.find((p) => p.id === picked);
  return (
    <form action={action} className="flex flex-col">
      <fieldset className="grid gap-2.5">
        <legend className="sr-only">Pilih paket</legend>
        {packages.map((p) => (
          <Choice
            key={p.id}
            type="radio"
            name="package"
            value={p.id}
            checked={picked === p.id}
            onChange={() => setPicked(p.id)}
            title={`Bayar ${formatRupiah(p.pay)}`}
            detail={p.get > p.pay ? `Jadi saldo ${formatRupiah(p.get)}` : "Tanpa bonus"}
            detailTone={p.get > p.pay ? "ok" : "muted"}
            aside={p.get > p.pay ? `+${formatShort(p.get - p.pay)}` : ""}
          />
        ))}
      </fieldset>
      {state.error ? (
        <Notice title="Belum bisa lanjut" tone="alert" className="mt-4">
          <span role="alert">{state.error}</span>
        </Notice>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-md px-4 py-3">
          <button type="submit" className={buttonClass("primary", true)} disabled={pending || !pkg}>
            {pending ? "Menyiapkan QRIS…" : pkg ? `Bayar ${formatRupiah(pkg.pay)} pakai QRIS` : "Pilih paket"}
          </button>
        </div>
      </div>
    </form>
  );
}
