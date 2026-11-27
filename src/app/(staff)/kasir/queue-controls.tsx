"use client";

import { useActionState, useEffect, useState } from "react";
import { buttonClass } from "@/components/button";
import { PlusIcon } from "@/components/icons";
import { addWalkIn, type QueueActionState, queueAction } from "@/server/actions/queue";

type Op = Parameters<typeof queueAction>[0];

type Props = {
  op: Op;
  entryId: string;
  label: string;
  variant?: "primary" | "dark" | "quiet" | "text";
  /** ISO time before which the button stays disabled (the late grace period). */
  enableAt?: string | null;
  block?: boolean;
};

/** One tap, one action. Errors show right under the button. */
export function QueueButton({ op, entryId, label, variant = "dark", enableAt, block }: Props) {
  const [state, action, pending] = useActionState<QueueActionState>(queueAction.bind(null, op, entryId), {});
  const ready = useReadyAt(enableAt);
  const cls =
    variant === "text"
      ? "min-h-11 rounded-lg px-2 text-sm font-medium text-muted hover:bg-sunk hover:text-fg disabled:opacity-40"
      : `${buttonClass(variant, block)} min-h-11 px-4`;
  return (
    <form action={action} className={block ? "w-full" : ""}>
      <button type="submit" className={cls} disabled={pending || !ready}>
        {pending ? "…" : ready || !enableAt ? label : `${label} ${countdown(enableAt)}`}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * "Batal" on a prepaid online entry asks who is cancelling, because the money goes
 * different ways: the customer cancelling keeps it as credit (or member balance),
 * the shop cancelling sends it back to their bank or e-wallet.
 */
export function CancelPrepaid({ entryId }: { entryId: string }) {
  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg px-2 text-sm font-medium text-muted hover:bg-sunk hover:text-fg [&::-webkit-details-marker]:hidden">
        Batal
      </summary>
      <div className="absolute top-full right-0 z-20 mt-1 grid w-64 gap-1 rounded-xl border border-rule-strong bg-surface p-2">
        <p className="px-2 pt-1 pb-2 text-sm text-muted">Sudah bayar online. Siapa yang membatalkan?</p>
        <QueueButton
          op="cancel"
          entryId={entryId}
          label="Pelanggan, uang jadi kredit"
          variant="quiet"
          block
        />
        <QueueButton
          op="shop_cancel"
          entryId={entryId}
          label="Toko, uang dikembalikan"
          variant="quiet"
          block
        />
      </div>
    </details>
  );
}

/** "+ Walk-in" opens a short form downward: every customer gives a name and WhatsApp number. */
export function WalkInForm({ barberId, barberName }: { barberId: string; barberName: string }) {
  const [state, action, pending] = useActionState<QueueActionState, FormData>(addWalkIn, {});
  return (
    <details className="row border-t border-rule" key={state.ok}>
      <summary className="flex min-h-12 items-center justify-center gap-1.5 rounded-b-2xl text-sm font-medium text-muted hover:bg-bg hover:text-fg">
        <PlusIcon size={18} />
        Walk-in
      </summary>
      <form action={action} className="grid gap-3 px-4 pt-2 pb-4">
        <input type="hidden" name="barberId" value={barberId} />
        <label className="text-sm font-medium" htmlFor={`walkin-${barberId}`}>
          Nama
        </label>
        <input
          id={`walkin-${barberId}`}
          name="name"
          autoComplete="off"
          maxLength={40}
          required
          className={walkInInput}
        />
        <label className="text-sm font-medium" htmlFor={`walkin-wa-${barberId}`}>
          Nomor WhatsApp
        </label>
        <input
          id={`walkin-wa-${barberId}`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={20}
          required
          aria-describedby={`walkin-wa-hint-${barberId}`}
          className={walkInInput}
        />
        <p id={`walkin-wa-hint-${barberId}`} className="-mt-1 text-sm text-faint">
          Kami kabari saat tinggal 2 orang lagi
        </p>
        <button type="submit" className={`${buttonClass("dark", true)} min-h-11`} disabled={pending}>
          {pending ? "Menambahkan…" : `Tambah ke antrean ${barberName}`}
        </button>
        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}
      </form>
    </details>
  );
}

const walkInInput =
  "min-h-11 rounded-xl border border-rule-strong bg-surface px-3 outline-none focus:border-blue focus:ring-3 focus:ring-blue-soft";

function useReadyAt(iso?: string | null) {
  const at = iso ? new Date(iso).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at || now >= at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [at, now]);
  return !at || now >= at;
}

function countdown(iso: string) {
  const s = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
