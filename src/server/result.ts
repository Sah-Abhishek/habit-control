import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

/**
 * Uniform return shape for server actions so the UI can always tell success from
 * failure and show field-level messages without parsing exceptions.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** A failure we expect and can explain to the user (validation, not found, conflict). */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class NotFoundError extends UserFacingError {
  constructor(what = "That item") {
    super(`${what} no longer exists. It may have been deleted in another tab.`);
    this.name = "NotFoundError";
  }
}

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Postgres error codes we translate into user-facing messages. */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Validates `input` with `schema`, runs `fn`, and converts known failures into an
 * ActionResult. Unexpected errors are logged with context and returned as a generic
 * message — internals never reach the client.
 */
export async function runAction<S extends z.ZodType, T>(
  name: string,
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  try {
    return { ok: true, data: await fn(parsed.data) };
  } catch (err) {
    // Let Next.js control-flow errors (redirect / notFound) propagate.
    unstable_rethrow(err);
    if (err instanceof UserFacingError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    const code = pgCode(err);
    if (code === "23505") return { ok: false, error: "That already exists — refresh to see the latest version." };
    if (code === "23503") return { ok: false, error: "Something this refers to was deleted. Refresh and try again." };
    if (code === "23514") return { ok: false, error: "That value is outside the allowed range." };
    console.error(`[action:${name}] failed`, {
      code,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "We couldn’t save that. Your other data is safe — please try again." };
  }
}
