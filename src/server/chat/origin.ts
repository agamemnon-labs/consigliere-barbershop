import "server-only";
import { env } from "@/server/env";

/** The public origin links in answers should point to. */
export function siteOrigin(request?: Request): string {
  const configured = env().BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return request ? new URL(request.url).origin : "http://localhost:3000";
}
