/**
 * Browser error tracking with Sentry. Without NEXT_PUBLIC_SENTRY_DSN at build time this whole
 * branch is dropped, so the SDK never reaches the phone. With it, the SDK loads after the page
 * is interactive and stays out of the first paint.
 */
import { sentryDataCollection } from "@/config/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      dataCollection: sentryDataCollection,
    });
  });
}
