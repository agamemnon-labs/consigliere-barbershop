"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CardIcon, HomeIcon, TicketIcon } from "./icons";
import { type MyTicket, onMyTicketChange, readMyTicket } from "./my-ticket";

/** Screens that are a step of a flow keep their own bottom bar instead. */
const HIDDEN = [/^\/antre/, /^\/cabang\//, /^\/kartu\/isi/, /^\/demo/, /^\/gaya/, /^\/studi-kasus/];

/**
 * The customer app's three places, in thumb reach: home, your number, your member card.
 * "Nomor" becomes "Tiketku" and opens the ticket once this phone has one for today.
 */
export function BottomNav() {
  const path = usePathname();
  const [ticket, setTicket] = useState<MyTicket | null>(null);
  useEffect(() => {
    const sync = () => setTicket(readMyTicket());
    sync();
    return onMyTicketChange(sync);
  }, []);

  if (HIDDEN.some((r) => r.test(path))) return null;

  const items = [
    { href: "/", label: "Beranda", icon: HomeIcon, active: path === "/" || path.startsWith("/cabang") },
    ticket
      ? {
          href: `/tiket/${ticket.id}`,
          label: ticket.label ? `Tiketku ${ticket.label}` : "Tiketku",
          icon: TicketIcon,
          active: path.startsWith("/tiket"),
          dot: true,
        }
      : { href: "/antre", label: "Ambil nomor", icon: TicketIcon, active: path.startsWith("/tiket") },
    {
      href: "/kartu",
      label: "Member",
      icon: CardIcon,
      active: path.startsWith("/kartu") || path.startsWith("/masuk"),
    },
  ] as const;

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href as "/"}
              aria-current={it.active ? "page" : undefined}
              className={`relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                it.active ? "text-fg" : "text-faint hover:text-fg"
              }`}
            >
              <span className="relative">
                <it.icon size={22} strokeWidth={it.active ? 2.1 : 1.75} />
                {"dot" in it && it.dot ? (
                  <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full border-2 border-surface bg-accent" />
                ) : null}
              </span>
              <span className="num">{it.label}</span>
              {it.active ? (
                <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
