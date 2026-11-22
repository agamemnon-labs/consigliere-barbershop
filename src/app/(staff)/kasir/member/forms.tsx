"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/button";
import { Field } from "@/components/field";
import { formatRupiah } from "@/domain/money";
import { type FormState, signUpMember, topUpMember } from "@/server/actions/membership";

function EdcChoice() {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="label mb-1.5">Bayar di EDC</legend>
      {(
        [
          ["edc_qris", "QRIS"],
          ["edc_card", "Kartu"],
        ] as const
      ).map(([value, text]) => (
        <label
          key={value}
          className="flex min-h-12 cursor-pointer items-center justify-center border border-rule-strong has-checked:border-fg has-checked:bg-fg has-checked:text-bg"
        >
          <input type="radio" name="edc" value={value} required className="sr-only" />
          {text}
        </label>
      ))}
    </fieldset>
  );
}

/** Sign-up at the counter. The member types the PIN themselves; the cashier never needs to know it. */
export function SignUpForm({ fee, phone }: { fee: number; phone: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpMember, {});
  const v = state.values ?? {};
  return (
    <section aria-label="Daftar member baru" className="border-t border-rule pt-6">
      <h2 className="font-display text-2xl">Daftar member baru</h2>
      <p className="mt-1 text-muted">Biaya {formatRupiah(fee)}, sekali saja</p>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Nama" name="name" required autoComplete="off" defaultValue={v.name} />
        <Field
          label="WhatsApp"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="off"
          defaultValue={v.phone ?? phone}
          hint="Dipakai untuk masuk dan kode lupa PIN."
        />
        <Field label="Tanggal lahir" name="dob" type="date" required defaultValue={v.dob} />
        <div className="hidden sm:block" />
        <Field
          label="PIN 6 angka (diketik member)"
          name="pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          required
          autoComplete="off"
          hint="Bukan tanggal lahir, bukan 123456."
        />
        <Field
          label="Ulangi PIN"
          name="pin2"
          type="password"
          inputMode="numeric"
          maxLength={6}
          required
          autoComplete="off"
        />
        <div className="sm:col-span-2">
          <EdcChoice />
        </div>
        {state.error ? (
          <p role="alert" className="text-accent-ink sm:col-span-2">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={`${buttonClass("accent", true)} sm:col-span-2`}>
          {pending ? "Menyimpan…" : `Daftar & lunas ${formatRupiah(fee)}`}
        </button>
      </form>
    </section>
  );
}

type Package = { id: string; pay: number; get: number };

export function TopUpForm({ memberId, packages }: { memberId: string; packages: Package[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(topUpMember, {});
  if (packages.length === 0) return <p className="text-muted">Belum ada paket top-up.</p>;
  return (
    <form action={action} aria-label="Top-up saldo" className="grid content-start gap-4">
      <input type="hidden" name="memberId" value={memberId} />
      <fieldset className="grid gap-2">
        <legend className="label mb-1.5">Top-up saldo</legend>
        {packages.map((p) => (
          <label
            key={p.id}
            className="flex min-h-12 cursor-pointer items-baseline justify-between gap-3 border border-rule-strong px-4 py-3 has-checked:border-fg has-checked:bg-fg has-checked:text-bg"
          >
            <input type="radio" name="packageId" value={p.id} required className="sr-only" />
            <span>
              Bayar <span className="num">{formatRupiah(p.pay)}</span>
            </span>
            <span>
              dapat <span className="num">{formatRupiah(p.get)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <EdcChoice />
      {state.error ? (
        <p role="alert" className="text-accent-ink">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass("accent", true)}>
        {pending ? "Menyimpan…" : "Lunas, tambah saldo"}
      </button>
    </form>
  );
}
