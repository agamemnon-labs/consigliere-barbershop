/**
 * Queue rules. One queue per barber per day; online and walk-in share it.
 * Pure functions: they take the barber's entries and return patches to apply.
 * The server applies the patches inside one transaction.
 */

export type QueueStatus = "waiting" | "called" | "in_service" | "done" | "no_show" | "cancelled";

export type QueueEntry = {
  id: string;
  position: number;
  status: QueueStatus;
  calledAt: Date | null;
  graceUntil: Date | null;
  startedAt: Date | null;
  lateMoves: number;
  estimatedMin: number;
};

export type Patch = { id: string } & Partial<
  Pick<QueueEntry, "position" | "status" | "calledAt" | "graceUntil" | "startedAt" | "lateMoves"> & {
    finishedAt: Date;
  }
>;

export class QueueError extends Error {
  override name = "QueueError";
}

const ACTIVE: QueueStatus[] = ["in_service", "called", "waiting"];

/** Entries still in the queue, in order. Whoever is in the chair comes first. */
export function activeEntries<T extends QueueEntry>(entries: T[]): T[] {
  return entries
    .filter((e) => ACTIVE.includes(e.status))
    .sort((a, b) => rank(a) - rank(b) || a.position - b.position);
}

function rank(e: QueueEntry) {
  return e.status === "in_service" ? 0 : 1;
}

/** Position for a newcomer: the back of the line. */
export function nextPosition(entries: QueueEntry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.position), 0) + 1;
}

/** The entry the cashier can call now: the first waiting one, if nobody is already called. */
export function callable<T extends QueueEntry>(entries: T[]): T | undefined {
  if (entries.some((e) => e.status === "called")) return undefined;
  return activeEntries(entries).find((e) => e.status === "waiting");
}

export function call(entries: QueueEntry[], id: string, now: Date, graceMin: number): Patch[] {
  const next = callable(entries);
  if (!next || next.id !== id) throw new QueueError("Hanya antrean paling depan yang bisa dipanggil.");
  return [{ id, status: "called", calledAt: now, graceUntil: new Date(now.getTime() + graceMin * 60_000) }];
}

/** Customer sits down. A called customer, or the front walk-in when the chair is free. */
export function start(entries: QueueEntry[], id: string, now: Date): Patch[] {
  if (entries.some((e) => e.status === "in_service")) {
    throw new QueueError("Kursi masih terisi. Selesaikan yang sedang dipotong dulu.");
  }
  const entry = find(entries, id);
  const front = activeEntries(entries)[0];
  if (entry.status !== "called" && !(entry.status === "waiting" && front?.id === id)) {
    throw new QueueError("Pelanggan ini belum gilirannya.");
  }
  return [{ id, status: "in_service", startedAt: now }];
}

export function finish(entries: QueueEntry[], id: string, now: Date): Patch[] {
  const entry = find(entries, id);
  if (entry.status !== "in_service") throw new QueueError("Pelanggan ini belum mulai dipotong.");
  return [{ id, status: "done", finishedAt: now }];
}

/**
 * Called customer is not here after the grace period.
 * First time: they move back exactly one place. Second time: no-show.
 */
export function late(entries: QueueEntry[], id: string, now: Date): Patch[] {
  const entry = find(entries, id);
  if (entry.status !== "called" || !entry.graceUntil) throw new QueueError("Pelanggan ini belum dipanggil.");
  if (now < entry.graceUntil) throw new QueueError("Masih dalam waktu tunggu.");
  if (entry.lateMoves >= 1) return [{ id, status: "no_show" }];

  const reset = {
    status: "waiting" as const,
    calledAt: null,
    graceUntil: null,
    lateMoves: entry.lateMoves + 1,
  };
  const behind = activeEntries(entries).find((e) => e.status === "waiting" && e.position > entry.position);
  if (!behind) return [{ id, ...reset }];
  return [
    { id, ...reset, position: behind.position },
    { id: behind.id, position: entry.position },
  ];
}

export function cancel(entries: QueueEntry[], id: string): Patch[] {
  const entry = find(entries, id);
  if (entry.status !== "waiting" && entry.status !== "called") {
    throw new QueueError("Antrean ini tidak bisa dibatalkan.");
  }
  return [{ id, status: "cancelled" }];
}

/** Minutes until each active entry's turn, and how many are ahead of them. */
export function estimates(entries: QueueEntry[], now: Date): Map<string, { ahead: number; waitMin: number }> {
  const out = new Map<string, { ahead: number; waitMin: number }>();
  let wait = 0;
  activeEntries(entries).forEach((e, i) => {
    out.set(e.id, { ahead: i, waitMin: Math.round(wait) });
    wait += remaining(e, now);
  });
  return out;
}

/** How long someone joining now would wait for this barber. */
export function waitForNewcomer(entries: QueueEntry[], now: Date): number {
  return Math.round(activeEntries(entries).reduce((sum, e) => sum + remaining(e, now), 0));
}

/** Minutes of work left for an entry. An overrunning cut still counts five more minutes. */
function remaining(e: QueueEntry, now: Date): number {
  if (e.status !== "in_service" || !e.startedAt) return e.estimatedMin;
  const elapsed = (now.getTime() - e.startedAt.getTime()) / 60_000;
  return Math.max(5, e.estimatedMin - elapsed);
}

/**
 * Ticket prefix for a branch: the first letter of its own name, skipping a street word, so
 * "Jl. Pulau Kalimantan" is P, "Jl. Belatuk" is B and "Citra Niaga" is C.
 */
export function branchPrefix(name: string): string {
  const own = name.trim().replace(/^(jl\.?|jln\.?|jalan)\s+/i, "");
  return (own || name.trim()).charAt(0).toUpperCase();
}

/** "P 014" */
export function ticketLabel(prefix: string, n: number): string {
  return `${prefix} ${String(n).padStart(3, "0")}`;
}

function find(entries: QueueEntry[], id: string): QueueEntry {
  const e = entries.find((x) => x.id === id);
  if (!e) throw new QueueError("Antrean tidak ditemukan.");
  return e;
}
