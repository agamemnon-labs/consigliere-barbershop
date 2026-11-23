"use client";

import { useEffect } from "react";
import { writeMyTicket } from "./my-ticket";

/** Mounted on a ticket page: remembers (or forgets) this phone's ticket for the bottom bar. */
export function RememberTicket({ id, label, until }: { id: string; label: string; until: string | null }) {
  useEffect(() => {
    writeMyTicket(until ? { id, label, until } : null);
  }, [id, label, until]);
  return null;
}
