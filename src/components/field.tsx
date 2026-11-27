import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string | undefined;
};

/** Boxed field with its label above, never a placeholder-as-label. */
export function Field({ label, hint, error, id, name, className = "", ...props }: Props) {
  const fieldId = id ?? name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={fieldId} className="text-[0.9375rem] font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "min-h-13 w-full rounded-xl border border-rule-strong bg-surface px-4 text-lg text-fg outline-none transition-colors placeholder:text-faint hover:border-faint focus:border-blue focus:ring-3 focus:ring-blue-soft aria-invalid:border-danger";
