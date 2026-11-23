/**
 * WhatsApp message rules: who gets the "your turn is near" alert, what the
 * messages say, and how often one number may be messaged. Pure functions.
 */
import { activeEntries, type QueueEntry } from "./queue";

/** The alert goes out when this many people (or fewer) are ahead. */
export const NEAR_AHEAD = 2;

/** Most real WhatsApp messages one number gets per shop day, so a public demo can't be used to spam. */
export const DAILY_CAP = 5;

/** Minutes a forgot-PIN code stays valid. */
export const OTP_MINUTES = 10;

export type AlertCandidate = QueueEntry & { nearAlertAt: Date | null; phone: string | null };

/**
 * Entries that should get the "near" alert now: still waiting, never alerted,
 * with a WhatsApp number, and at most two people ahead.
 */
export function dueNearAlerts<T extends AlertCandidate>(entries: T[]): { entry: T; ahead: number }[] {
  return activeEntries(entries).flatMap((entry, ahead) =>
    entry.status === "waiting" && !entry.nearAlertAt && entry.phone && ahead <= NEAR_AHEAD
      ? [{ entry, ahead }]
      : [],
  );
}

/**
 * Someone who joins a line that is already short needs no alert: they can see
 * it on their ticket, and a message seconds later would only be noise.
 */
export function shortLineAtJoin(activeAhead: number): boolean {
  return activeAhead <= NEAR_AHEAD;
}

/** "tinggal 2 orang lagi", "tinggal 1 orang lagi", "kamu berikutnya" */
export function aheadPhrase(ahead: number): string {
  return ahead <= 0 ? "kamu berikutnya" : `tinggal ${ahead} orang lagi`;
}

/** Template values for the queue alert, in the order the Meta template numbers them. */
export function nearTurnParams(a: { name: string; branch: string; ahead: number; ticket: string }) {
  return [a.name, a.branch, aheadPhrase(a.ahead), a.ticket];
}

/** The readable copy kept in the admin log. Mirrors the approved template text. */
export function nearTurnBody(
  brandName: string,
  a: { name: string; branch: string; ahead: number; ticket: string },
) {
  return `Halo ${a.name}, giliranmu di ${brandName} ${a.branch} sudah dekat: ${aheadPhrase(a.ahead)}. Nomor antreanmu ${a.ticket}. Yuk mulai jalan ke sini.`;
}

/** The log copy of a forgot-PIN code. The code itself never goes in the log. */
export function otpBody(brandName: string): string {
  return `Kode ganti PIN ${brandName}: ••••••. Berlaku ${OTP_MINUTES} menit. Jangan berikan ke siapa pun, termasuk kasir.`;
}

/** Whether another real message may go to a number that already got `sentToday` today. */
export function underDailyCap(sentToday: number): boolean {
  return sentToday < DAILY_CAP;
}

/** Numbers allowed to get real messages; empty means everyone. Accepts 08…, 62… or +62…. */
export function parseAllowlist(
  raw: string | undefined,
  normalize: (s: string) => string | null,
): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((x) => normalize(x))
      .filter((x): x is string => x !== null),
  );
}
