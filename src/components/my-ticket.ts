/*
 * The customer's current ticket, remembered on their phone so "Tiketku" in the bottom bar
 * and the home page can bring them back to it. Only a pointer: the ticket page is the truth.
 * Browser storage can be missing (private mode, blocked), so every access is guarded.
 */

export type MyTicket = { id: string; label: string; until: string };

const KEY = "consigliere.tiket";
const EVENT = "consigliere:tiket";

export function readMyTicket(): MyTicket | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as MyTicket;
    if (!t.id || Date.now() > new Date(t.until).getTime()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function writeMyTicket(t: MyTicket | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage is a convenience; the ticket link still works without it.
  }
}

export function onMyTicketChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
