import type { BrowserContext } from "@playwright/test";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Staging end-to-end runs (Appendix B §6) sign in programmatically: the
 * sign-in page is magic-link only, so each actor's password session is
 * obtained with signInWithPassword against the staging anon key and
 * written as the cookie `@supabase/ssr` expects. Nothing here drives the
 * sign-in UI, and nothing here needs the service role.
 *
 * Required environment:
 *   STAGING_URL                  Vercel Preview URL of the branch
 *   STAGING_SUPABASE_ANON_KEY    the staging project's anon key
 *   STAGING_OWNER_EMAIL / STAGING_OWNER_PASSWORD
 *   STAGING_EDITOR_EMAIL / STAGING_EDITOR_PASSWORD
 * Optional:
 *   STAGING_SUPABASE_URL         defaults to the host /api/health reports
 */

export interface StagingAccount {
  email: string;
  password: string;
}

export interface StagingEnv {
  url: string;
  anonKey: string;
  supabaseUrl: string | null;
  owner: StagingAccount;
  editor: StagingAccount;
}

/** The environment, or null when any required variable is missing. */
export function stagingEnv(): StagingEnv | null {
  const e = process.env;
  if (
    !e.STAGING_URL ||
    !e.STAGING_SUPABASE_ANON_KEY ||
    !e.STAGING_OWNER_EMAIL ||
    !e.STAGING_OWNER_PASSWORD ||
    !e.STAGING_EDITOR_EMAIL ||
    !e.STAGING_EDITOR_PASSWORD
  ) {
    return null;
  }
  return {
    url: e.STAGING_URL.replace(/\/+$/, ""),
    anonKey: e.STAGING_SUPABASE_ANON_KEY,
    supabaseUrl: e.STAGING_SUPABASE_URL?.replace(/\/+$/, "") ?? null,
    owner: { email: e.STAGING_OWNER_EMAIL, password: e.STAGING_OWNER_PASSWORD },
    editor: {
      email: e.STAGING_EDITOR_EMAIL,
      password: e.STAGING_EDITOR_PASSWORD,
    },
  };
}

/** The Supabase URL the preview talks to, from its own health endpoint. */
export async function resolveSupabaseUrl(env: StagingEnv): Promise<string> {
  if (env.supabaseUrl) return env.supabaseUrl;
  const response = await fetch(`${env.url}/api/health`);
  if (!response.ok) {
    throw new Error(`${env.url}/api/health answered ${response.status}`);
  }
  const body = (await response.json()) as { supabase_host?: string | null };
  if (!body.supabase_host || body.supabase_host === "invalid-url") {
    throw new Error("The preview does not report its Supabase host");
  }
  return `https://${body.supabase_host}`;
}

export type StagingClient = SupabaseClient<Database>;

export interface Actor {
  account: StagingAccount;
  session: Session;
  userId: string;
  /** A supabase-js client acting as this user (RLS applies). */
  db: StagingClient;
}

export async function signIn(
  supabaseUrl: string,
  anonKey: string,
  account: StagingAccount,
): Promise<Actor> {
  const db = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.signInWithPassword(account);
  if (error || !data.session) {
    throw new Error(
      `Could not sign in ${account.email}: ${error?.message ?? "no session"}`,
    );
  }
  return { account, session: data.session, userId: data.session.user.id, db };
}

// @supabase/ssr: `sb-<project-ref>-auth-token`, value `base64-` + base64url
// of the session JSON, split into `.0`, `.1`, … cookies above 3180 chars.
const MAX_CHUNK_SIZE = 3180;

export function sessionCookies(
  session: Session,
  supabaseUrl: string,
  siteUrl: string,
): { name: string; value: string; url: string }[] {
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value =
    "base64-" +
    Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  if (value.length <= MAX_CHUNK_SIZE) return [{ name, value, url: siteUrl }];
  const chunks: { name: string; value: string; url: string }[] = [];
  for (let i = 0, at = 0; at < value.length; i++, at += MAX_CHUNK_SIZE) {
    chunks.push({
      name: `${name}.${i}`,
      value: value.slice(at, at + MAX_CHUNK_SIZE),
      url: siteUrl,
    });
  }
  return chunks;
}

/** A browser context signed in as the actor. */
export async function contextFor(
  browser: import("@playwright/test").Browser,
  actor: Actor,
  supabaseUrl: string,
  siteUrl: string,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addCookies(sessionCookies(actor.session, supabaseUrl, siteUrl));
  return context;
}
