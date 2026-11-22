"use client";

import { useActionState, useEffect, useState } from "react";
import { buttonClass } from "@/components/button";
import { addWalkIn, type QueueActionState, queueAction } from "@/server/actions/queue";

type Op = Parameters<typeof queueAction>[0];

type Props = {
  op: Op;
  entryId: string;
  label: string;
  variant?: "primary" | "accent" | "quiet" | "text";
  /** ISO time before which the button stays disabled (the late grace period). */
  enableAt?: string | null;
  block?: boolean;
};

/** One tap, one action. Errors show right under the button. */
export function QueueButton({ op, entryId, label, variant = "primary", enableAt, block }: Props) {
  const [state, action, pending] = useActionState<QueueActionState>(queueAction.bind(null, op, entryId), {});
  const ready = useReadyAt(enableAt);
  const cls =
    variant === "text"
      ? "label min-h-11 px-2 hover:text-fg disabled:opacity-40"
      : `${buttonClass(variant, block)} min-h-11 px-4`;
  return (
    <form action={action} className={block ? "w-full" : ""}>
      <button type="submit" className={cls} disabled={pending || !ready}>
        {pending ? "…" : ready || !enableAt ? label : `${label} ${countdown(enableAt)}`}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-accent-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** "+ Walk-in" opens a one-field form downward; the name is optional. */
export function WalkInForm({ barberId, barberName }: { barberId: string; barberName: string }) {
  const [state, action, pending] = useActionState<QueueActionState, FormData>(addWalkIn, {});
  return (
    <details className="row border-t border-rule" key={state.ok}>
      <summary className="flex min-h-12 items-center justify-center text-sm font-medium tracking-[0.02em] text-muted hover:bg-bg hover:text-fg">
        + Walk-in
      </summary>
      <form action={action} className="grid gap-3 px-4 pt-2 pb-4">
        <input type="hidden" name="barberId" value={barberId} />
        <label className="label" htmlFor={`walkin-${barberId}`}>
          Nama (boleh kosong)
        </label>
        <input
          id={`walkin-${barberId}`}
          name="name"
          autoComplete="off"
          maxLength={40}
          className="min-h-11 border-0 border-b border-rule-strong bg-transparent text-lg outline-none focus:border-fg"
        />
        <button type="submit" className={`${buttonClass("primary", true)} min-h-11`} disabled={pending}>
          {pending ? "Menambahkan…" : `Tambah ke antrean ${barberName}`}
        </button>
        {state.error ? (
          <p role="alert" className="text-sm text-accent-ink">
            {state.error}
          </p>
        ) : null}
      </form>
    </details>
  );
}

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
