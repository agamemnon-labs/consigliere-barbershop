import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string | undefined;
};

/** Underlined field, like a form filled in by hand. Label above, never a placeholder-as-label. */
export function Field({ label, hint, error, id, name, className = "", ...props }: Props) {
  const fieldId = id ?? name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-12 border-0 border-b border-rule-strong bg-transparent px-0 text-lg text-fg outline-none transition-colors placeholder:text-faint focus:border-fg focus-visible:outline-none aria-invalid:border-accent-ink"
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-accent-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
