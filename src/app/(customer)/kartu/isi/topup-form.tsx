"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/button";
import { formatRupiah } from "@/domain/money";
import { startTopup, type TopupState } from "@/server/actions/topup";

type Package = { id: string; pay: number; get: number };

export function TopupForm({ packages }: { packages: Package[] }) {
  const [state, action, pending] = useActionState<TopupState, FormData>(startTopup, {});
  const [picked, setPicked] = useState(packages[0]?.id);
  const pkg = packages.find((p) => p.id === picked);
  return (
    <form action={action} className="flex flex-col">
      <fieldset className="border-t border-rule">
        <legend className="sr-only">Pilih paket</legend>
        {packages.map((p) => (
          <label
            key={p.id}
            className="flex min-h-16 cursor-pointer items-center gap-4 border-b border-rule py-3"
          >
            <input
              type="radio"
              name="package"
              value={p.id}
              checked={picked === p.id}
              onChange={() => setPicked(p.id)}
              className="size-5 shrink-0 accent-fg"
            />
            <span className="flex-1">
              <span className="num block text-lg">{formatRupiah(p.pay)}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {p.get > p.pay ? `Jadi saldo ${formatRupiah(p.get)}` : "Tanpa bonus"}
              </span>
            </span>
            {p.get > p.pay ? <span className="num text-sm">+{formatRupiah(p.get - p.pay)}</span> : null}
          </label>
        ))}
      </fieldset>
      {state.error ? (
        <p role="alert" className="mt-4 text-sm text-accent-ink">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={`${buttonClass("accent", true)} mt-8`} disabled={pending || !pkg}>
        {pending ? "Menyiapkan QRIS…" : pkg ? `Bayar ${formatRupiah(pkg.pay)} dengan QRIS` : "Pilih paket"}
      </button>
    </form>
  );
}
