import type { ReactNode } from "react";

/** A section heading with an optional action on the right ("Lihat semua"). */
export function SectionTitle({
  children,
  action,
  id,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex min-h-11 items-center justify-between gap-4 ${className}`}>
      <h2 id={id} className="text-xl">
        {children}
      </h2>
      {action}
    </div>
  );
}
