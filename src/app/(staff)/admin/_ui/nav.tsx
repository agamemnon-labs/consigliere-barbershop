"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/admin", "Hari ini"],
  ["/admin/laporan", "Laporan"],
  ["/admin/rotasi", "Rotasi"],
  ["/admin/harga", "Harga"],
  ["/admin/barber", "Barber"],
  ["/admin/member", "Member"],
  ["/admin/aturan", "Aturan"],
  ["/admin/pesan", "Pesan"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Back office" className="border-b border-rule px-4 sm:px-6">
      <ul className="mx-auto flex max-w-5xl flex-wrap gap-x-5">
        {LINKS.map(([href, text]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center border-b-2 text-[0.9375rem] transition-colors ${
                  active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
