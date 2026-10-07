import "server-only";
import { z } from "zod";
import { resolveAppUrl, trustedOrigins } from "./app-url";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  /** Optional on Vercel — derived from VERCEL_* system variables when absent. */
  BETTER_AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast at startup with the variable names only — never echo values.
  const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment configuration — ${problems}`);
}

const appUrl = resolveAppUrl(process.env);
if (!appUrl) {
  throw new Error("Invalid environment configuration — set BETTER_AUTH_URL (the app's public URL), or deploy on Vercel where it is detected automatically");
}

export const env = { ...parsed.data, APP_URL: appUrl, TRUSTED_ORIGINS: trustedOrigins(process.env, appUrl) };
