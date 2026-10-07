/**
 * Public origin of the app, used by auth for callbacks and CSRF origin checks.
 *
 * Order: explicit BETTER_AUTH_URL → Vercel's production domain (production deploys)
 * → this deployment's URL (preview deploys) → error. On Vercel nothing needs to be
 * configured: VERCEL_* system variables are set automatically.
 */
type Vars = Record<string, string | undefined>;

const https = (host: string) => `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

export function resolveAppUrl(e: Vars): string | null {
  if (e.BETTER_AUTH_URL?.trim()) return e.BETTER_AUTH_URL.trim().replace(/\/+$/, "");
  if (e.VERCEL_ENV === "production" && e.VERCEL_PROJECT_PRODUCTION_URL) return https(e.VERCEL_PROJECT_PRODUCTION_URL);
  if (e.VERCEL_URL) return https(e.VERCEL_URL);
  return null;
}

/** Origins allowed to call the auth API: the app URL plus this deployment's own Vercel URLs. */
export function trustedOrigins(e: Vars, appUrl: string): string[] {
  const extra = [e.VERCEL_URL, e.VERCEL_BRANCH_URL, e.VERCEL_PROJECT_PRODUCTION_URL].filter((h): h is string => !!h).map(https);
  return [...new Set([appUrl, ...extra])];
}
