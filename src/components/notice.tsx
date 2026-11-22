import type { ReactNode } from "react";

/** A plain announcement (closures and the like). A rule in the accent colour, no box, no icon. */
export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <aside className="border-l-2 border-accent py-1 pl-4" aria-live="polite">
      <p className="label text-accent-ink">{title}</p>
      {children ? <div className="mt-1 text-[0.9375rem]">{children}</div> : null}
    </aside>
  );
}
