"use client";

import { type ReactNode, useActionState } from "react";
import { buttonClass } from "@/components/button";
import type { AdminState } from "@/server/actions/admin";

type Props = {
  action: (prev: AdminState, data: FormData) => Promise<AdminState>;
  children: ReactNode;
  submit: string;
  className?: string;
  variant?: "primary" | "quiet";
  label?: string;
};

/** A back-office form: fields, one button, and a quiet line saying it saved or what is wrong. */
export function AdminForm({ action, children, submit, className = "", variant = "primary", label }: Props) {
  const [state, run, pending] = useActionState<AdminState, FormData>(action, {});
  return (
    <form action={run} aria-label={label} className={`grid gap-4 ${className}`}>
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`${buttonClass(variant)} min-h-11`}>
          {pending ? "Menyimpan…" : submit}
        </button>
        {state.error ? (
          <p role="alert" className="text-sm text-accent-ink">
            {state.error}
          </p>
        ) : state.ok ? (
          <p role="status" className="text-sm text-muted">
            {state.message ?? "Tersimpan"}
          </p>
        ) : null}
      </div>
    </form>
  );
}
