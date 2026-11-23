import "server-only";
import { captureException } from "@sentry/nextjs";
import { after } from "next/server";
import { getDb } from "@/db";
import { deliver, nearTurnAlerts } from "./whatsapp";

/**
 * Runs WhatsApp work after the response has gone out, so a slow or failing
 * WhatsApp never holds up the cashier's tap or the customer's form.
 */
function later(job: () => Promise<void>) {
  after(async () => {
    try {
      await job();
    } catch (error) {
      console.error("[whatsapp]", error);
      captureException(error);
    }
  });
}

/** Sends messages already written to the outbox. */
export function deliverLater(ids: string[]) {
  if (ids.length) later(async () => deliver(await getDb(), ids));
}

/** A barber's line moved: alert whoever is now near the front. */
export function alertNearTurnsLater(barberId: string, date: string) {
  later(async () => {
    const db = await getDb();
    await deliver(db, await nearTurnAlerts(db, barberId, date, new Date()));
  });
}
