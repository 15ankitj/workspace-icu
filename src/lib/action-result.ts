import { unstable_rethrow } from "next/navigation";

/**
 * Results for server actions (src/app/actions). In production Next.js
 * masks an error thrown inside a server action before it reaches the
 * browser: the client receives a digest and React's generic "#441" text,
 * so every message written for the user — a permission refusal, a rate
 * limit, "invitation not found" — is lost. Expected failures are
 * therefore *returned*, never thrown. The lint rule in eslint.config.mjs
 * refuses a `throw` under src/app/actions so the bug cannot return.
 *
 * The message of a failure is a complete sentence — capitalised, with a
 * full stop — because a form renders it on its own, with no toast title
 * to lean on. It never carries content, secrets or internals: an
 * unexpected error becomes {@link GENERIC_ERROR} and is logged
 * server-side by code and message only.
 */

export type ActionFailure = { ok: false; error: string; code?: string };

export type ActionResult<T = object> = ({ ok: true } & T) | ActionFailure;

/** The state a `<form action>` holds through `useActionState`. */
export type FormState = ActionResult | null;

export const GENERIC_ERROR = "Something went wrong. Please try again.";
export const PERMISSION_ERROR = "You don't have permission to do that.";
export const RATE_LIMIT_ERROR = "Too many requests — try again in a minute.";
export const NOT_FOUND_ERROR = "Not found.";
export const CONFLICT_ERROR = "That already exists.";

export function ok(): { ok: true };
export function ok<T extends object>(data: T): { ok: true } & T;
export function ok<T extends object>(data?: T): { ok: true } & T {
  return { ok: true, ...(data ?? ({} as T)) };
}

/** A complete sentence: capitalised, one space between words, a stop. */
export function sentence(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  if (!flat) return GENERIC_ERROR;
  const capitalised = flat[0].toUpperCase() + flat.slice(1);
  return /[.!?…]["”')\]]?$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

export function fail(message: string, code?: string): ActionFailure {
  return code === undefined
    ? { ok: false, error: sentence(message) }
    : { ok: false, error: sentence(message), code };
}

export function isFailure<T>(result: ActionResult<T>): result is ActionFailure {
  return !result.ok;
}

interface ErrorShape {
  message: string;
  name?: string;
  code?: string;
  status?: number;
  details?: string;
}

/** Postgrest, Auth and Storage errors all carry a message and, variously,
 *  a code, an HTTP status and details; read whichever is there. */
function shapeOf(error: unknown): ErrorShape | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as Record<string, unknown>;
  if (typeof e.message !== "string") return null;
  const status =
    typeof e.status === "number"
      ? e.status
      : typeof e.statusCode === "number"
        ? e.statusCode
        : typeof e.statusCode === "string" && /^\d+$/.test(e.statusCode)
          ? Number(e.statusCode)
          : undefined;
  return {
    message: e.message,
    name: typeof e.name === "string" ? e.name : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    status,
    details: typeof e.details === "string" ? e.details : undefined,
  };
}

/** Prefix our own RPCs put on a refusal the editor handles quietly. */
const AUTHORED_PREFIX = /^authored_content:\s*/;

/**
 * A readable failure for an error a Supabase client returned or threw.
 * Our own `raise exception` messages (SQLSTATE P0001) are already
 * written as sentences and pass through verbatim; the common Postgres and
 * PostgREST codes get their standing wording; anything else is the
 * generic message, with the original logged (code and message only).
 */
export function fromSupabaseError(error: unknown): ActionFailure {
  const e = shapeOf(error);
  if (!e) {
    console.error("Action failed:", typeof error, String(error).slice(0, 200));
    return fail(GENERIC_ERROR, "unexpected");
  }
  if (e.status === 429 || /rate limit|too many requests/i.test(e.message)) {
    return fail(RATE_LIMIT_ERROR, "rate_limited");
  }
  if (e.code === "42501" || /row-level security/i.test(e.message)) {
    return fail(PERMISSION_ERROR, "permission_denied");
  }
  if (e.code === "23505") return fail(CONFLICT_ERROR, "conflict");
  if (e.code === "PGRST116") return fail(NOT_FOUND_ERROR, "not_found");
  if (e.code === "P0001") {
    if (AUTHORED_PREFIX.test(e.message)) {
      return fail(e.message.replace(AUTHORED_PREFIX, ""), "authored_content");
    }
    return fail(e.message, "refused");
  }
  if (e.status === 401 || e.status === 403) {
    return fail(PERMISSION_ERROR, "permission_denied");
  }
  if (e.status === 404) return fail(NOT_FOUND_ERROR, "not_found");
  console.error(
    "Action failed:",
    [e.name ?? "Error", e.code ?? e.status ?? ""].filter(Boolean).join(" "),
    e.message.slice(0, 200),
  );
  return fail(GENERIC_ERROR, "unexpected");
}

/**
 * Run an action body. What it returns is returned; what it throws becomes
 * a failure through {@link fromSupabaseError} — except Next.js's own
 * control flow (`redirect()`, `notFound()`), which is rethrown so that
 * `requireUser()`'s redirect to sign-in keeps working.
 */
export async function runAction<T extends object>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    return fromSupabaseError(error);
  }
}
