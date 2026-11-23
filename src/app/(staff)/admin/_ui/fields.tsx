import type { ComponentProps } from "react";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-rule-strong bg-surface px-3 text-fg outline-none transition-colors hover:border-faint focus:border-blue focus:ring-3 focus:ring-blue-soft";

/** Label over an input, both small. For dense back-office forms. */
export function Input({ label, className = "", ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      <input className={`${inputClass} ${props.inputMode === "numeric" ? "num" : ""}`} {...props} />
    </label>
  );
}

export function Check({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input type="checkbox" className="size-4 accent-blue" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** A number and what it is, for summary rows. */
export function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`num mt-0.5 font-semibold ${strong ? "text-[1.75rem] leading-tight" : "text-xl"}`}>
        {value}
      </dd>
    </div>
  );
}
