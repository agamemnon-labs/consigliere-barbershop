import "server-only";
import { withMonitor } from "@sentry/nextjs";

/**
 * Runs a Vercel Cron job as a Sentry cron monitor, so a job that fails, hangs or stops running
 * raises an alert. Without Sentry configured it just runs the job.
 * `schedule` must match the entry in vercel.json (UTC).
 * Vercel Hobby fires a cron at any minute within its hour (the demo reset lands around :57),
 * so the check-in margin covers the whole hour; a tighter one raises false "missed" alerts.
 */
export function cronJob<T>(slug: string, schedule: string, job: () => Promise<T>): Promise<T> {
  return withMonitor(slug, job, {
    schedule: { type: "crontab", value: schedule },
    timezone: "Etc/UTC",
    checkinMargin: 60,
    maxRuntime: 5,
  });
}
