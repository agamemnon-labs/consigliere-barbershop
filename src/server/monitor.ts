import "server-only";
import { withMonitor } from "@sentry/nextjs";

/**
 * Runs a Vercel Cron job as a Sentry cron monitor, so a job that fails, hangs or stops running
 * raises an alert. Without Sentry configured it just runs the job.
 * `schedule` must match the entry in vercel.json (UTC).
 */
export function cronJob<T>(slug: string, schedule: string, job: () => Promise<T>): Promise<T> {
  return withMonitor(slug, job, {
    schedule: { type: "crontab", value: schedule },
    timezone: "Etc/UTC",
    checkinMargin: 10,
    maxRuntime: 5,
  });
}
