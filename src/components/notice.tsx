import type { ReactNode } from "react";

type Tone = "info" | "warn" | "ok" | "alert";

const tones: Record<Tone, string> = {
  info: "bg-blue-soft text-fg [&_.notice-title]:text-blue",
  warn: "bg-butter text-fg [&_.notice-title]:text-butter-ink",
  ok: "bg-mint text-fg [&_.notice-title]:text-mint-ink",
  alert: "bg-danger-soft text-fg [&_.notice-title]:text-danger",
};

/** A short announcement on a soft fill: closures, demo notes, confirmations. */
export function Notice({
  title,
  tone = "warn",
  children,
  className = "",
}: {
  title: string;
  tone?: Tone;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <aside className={`rounded-2xl px-4 py-3 ${tones[tone]} ${className}`} aria-live="polite">
      <p className="notice-title text-[0.9375rem] font-semibold">{title}</p>
      {children ? <div className="mt-0.5 text-[0.9375rem] text-muted">{children}</div> : null}
    </aside>
  );
}
