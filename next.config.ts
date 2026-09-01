import type { NextConfig } from "next";

/**
 * Committed fallbacks for the Supabase connection. These are PUBLISHABLE
 * values — the URL and anon key ship in the browser bundle by design and
 * row-level security is the authorisation boundary — so committing them is
 * safe. Anything secret (service-role, provider keys) stays in Supabase /
 * Vercel settings only, per docs/runbook.md.
 *
 * Resolution order (evaluated at build time):
 *   1. NEXT_PUBLIC_* env vars, when set (Vercel dashboard, CI) — always win.
 *   2. Production builds (VERCEL_ENV=production) → the production project.
 *   3. Everything else (previews, local, CI) → the staging project.
 */
const SUPABASE_FALLBACKS = {
  production: {
    url: "https://pdohpjmlvlwnglflmlzf.supabase.co",
    anonKey: "sb_publishable_VyDm9pQ-1JEbWocdd_ThuQ_-lgg8n4k",
  },
  staging: {
    url: "https://cipeznsdjzkltardxveb.supabase.co",
    anonKey: "sb_publishable_08Iu-xPEHvOPpexLr8X9Hg_RpxpwQk-",
  },
};

const fallback =
  process.env.VERCEL_ENV === "production"
    ? SUPABASE_FALLBACKS.production
    : SUPABASE_FALLBACKS.staging;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallback.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallback.anonKey,
  },
};

export default nextConfig;
