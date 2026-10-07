import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { LocalDate } from "@/domain/dates";
import { auth } from "@/server/auth/auth";
import { NotFoundError, UserFacingError } from "@/server/result";
import { getToday, type Settings } from "@/server/services/settings";

/**
 * REST API for native clients (/api/v1). Conventions:
 * - Auth: `Authorization: Bearer <token>` only. Cookies are ignored here, which
 *   makes these endpoints immune to CSRF from the website.
 * - Success: 200/201 with the JSON body as documented in docs/api.md.
 * - Errors: `{ "error": { "code", "message", "fieldErrors"? } }` with a matching status.
 * - Dates are `YYYY-MM-DD` in the user's timezone; instants are ISO-8601 UTC.
 */

export type ApiContext = {
  req: Request;
  userId: string;
  email: string;
  name: string;
  today: LocalDate;
  settings: Settings;
};

export type ApiErrorCode = "unauthorized" | "validation" | "not_found" | "conflict" | "unprocessable" | "internal";

export function apiError(status: number, code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

async function authenticate(req: Request) {
  const header = req.headers.get("authorization");
  if (!header || !/^bearer\s+\S+/i.test(header)) return null;
  // Pass only the Authorization header so a browser cookie can never authenticate an API call.
  const session = await auth.api.getSession({ headers: new Headers({ authorization: header }) });
  return session ? session.user : null;
}

/** Validates an already-parsed value (e.g. a merged PATCH body); failures are 400s with field errors. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiValidationError(fieldErrors(parsed.error));
  return parsed.data;
}

/** Parses the JSON body with `schema`; a malformed body is a 400, never a 500. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiValidationError({ _form: "Request body must be valid JSON" });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiValidationError(fieldErrors(parsed.error));
  return parsed.data;
}

/** Parses query-string parameters with `schema`. */
export function readQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new ApiValidationError(fieldErrors(parsed.error));
  return parsed.data;
}

/** Validates a dynamic path segment (e.g. an id) with `schema`; failures are 404s. */
export function readParam<S extends z.ZodType>(value: unknown, schema: S): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new NotFoundError("That item");
  return parsed.data;
}

export class ApiValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super("Please check the highlighted fields.");
  }
}

/**
 * Wraps a route handler: authenticates, resolves the user's "today", maps known
 * failures to statuses and logs unexpected ones with a request id (never leaked).
 */
export function apiRoute<P = unknown>(fn: (ctx: ApiContext, params: P) => Promise<Response>) {
  return async (req: Request, routeCtx: { params: Promise<P> }): Promise<Response> => {
    const requestId = randomUUID();
    try {
      const user = await authenticate(req);
      if (!user) return apiError(401, "unauthorized", "Sign in again to continue.");
      const { today, settings } = await getToday(user.id);
      const params = (await routeCtx?.params) ?? ({} as P);
      return await fn({ req, userId: user.id, email: user.email, name: user.name, today, settings }, params);
    } catch (err) {
      if (err instanceof ApiValidationError) return apiError(400, "validation", err.message, err.fieldErrors);
      if (err instanceof NotFoundError) return apiError(404, "not_found", err.message);
      if (err instanceof UserFacingError) return apiError(422, "unprocessable", err.message, err.fieldErrors);
      const code = pgCode(err);
      if (code === "23505") return apiError(409, "conflict", "That already exists — refresh to see the latest version.");
      if (code === "23503") return apiError(409, "conflict", "Something this refers to was deleted. Refresh and try again.");
      if (code === "23514") return apiError(422, "unprocessable", "That value is outside the allowed range.");
      if (code === "22P02") return apiError(404, "not_found", "That item no longer exists.");
      console.error(`[api] ${req.method} ${new URL(req.url).pathname} failed`, {
        requestId,
        code,
        message: err instanceof Error ? err.message : String(err),
      });
      return apiError(500, "internal", `Something went wrong on our side. Reference: ${requestId.slice(0, 8)}`);
    }
  };
}
