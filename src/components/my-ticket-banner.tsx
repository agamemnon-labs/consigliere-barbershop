"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRightIcon, QrIcon } from "./icons";
import { type MyTicket, onMyTicketChange, readMyTicket } from "./my-ticket";

/** On home: "you already have a number" comes before "take a number". */
export function MyTicketBanner() {
  const [ticket, setTicket] = useState<MyTicket | null>(null);
  useEffect(() => {
    const sync = () => setTicket(readMyTicket());
    sync();
    return onMyTicketChange(sync);
  }, []);
  if (!ticket) return null;
  return (
    <Link
      href={`/tiket/${ticket.id}` as "/"}
      className="mb-4 flex min-h-16 items-center gap-4 rounded-2xl bg-accent px-4 py-3 text-accent-fg hover:bg-accent-hover"
    >
      {ticket.label ? (
        <span className="slab text-[1.75rem] leading-none">{ticket.label}</span>
      ) : (
        <QrIcon size={28} />
      )}
      <span className="flex-1">
        <span className="block font-medium">{ticket.label ? "Tiketmu hari ini" : "Belum dibayar"}</span>
        <span className="block text-sm text-white/90">
          {ticket.label ? "Lihat giliran dan perkiraan jam" : "Selesaikan QRIS untuk dapat nomor"}
        </span>
      </span>
      <ChevronRightIcon />
    </Link>
  );
}
