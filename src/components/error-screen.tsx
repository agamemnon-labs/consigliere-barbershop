"use client";

import { useEffect } from "react";
import { Button } from "./button";
import { Wordmark } from "./wordmark";

/**
 * Sends a browser-side crash to Sentry when it is configured. Errors from the server carry a
 * digest and were already reported there by `onRequestError`, so they are not sent twice.
 */
function sendErrorReport(error: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (error instanceof Error && "digest" in error && error.digest) return;
  import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
}

/** What a visitor sees when a screen crashes: one sentence and one way out. */
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => sendErrorReport(error), [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Wordmark />
      <h1 className="mt-8 text-[1.875rem]">Ada yang macet di sistem kami</h1>
      <p className="mt-2 text-muted">Coba sekali lagi. Kalau masih gagal, tanyakan ke kasir</p>
      <Button type="button" variant="dark" className="mt-6 self-start" onClick={() => retry()}>
        Coba lagi
      </Button>
    </main>
  );
}
