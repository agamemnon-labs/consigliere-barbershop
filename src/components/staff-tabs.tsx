"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string /** Match only this exact path (section home pages). */;
  exact?: boolean;
};

/** Section tabs under the staff header. They wrap on a phone instead of scrolling sideways. */
export function StaffTabs({ tabs, label }: { tabs: readonly Tab[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="px-4 sm:px-6">
      <ul className="flex flex-wrap gap-x-5">
        {tabs.map((t) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href as "/"}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 items-center text-[0.9375rem] transition-colors ${
                  active ? "font-medium text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
                {active ? (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
