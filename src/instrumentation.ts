import type { Instrumentation } from "next";
import { sentryDataCollection } from "@/config/sentry";

/**
 * Server error tracking with Sentry. Off until a DSN is set (the Sentry integration on Vercel sets
 * it), so local runs, tests and CI never load the SDK. Errors only, no performance tracing:
 * Vercel Speed Insights covers speed.
 */
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    dataCollection: sentryDataCollection,
  });
}

/** Errors thrown while rendering, in route handlers, server actions and the proxy. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!dsn) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(error, request, context);
};
