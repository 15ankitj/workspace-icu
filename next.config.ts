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

/**
 * Content Security Policy (brief §12). Frames are limited to the embed
 * whitelist (src/lib/embed.ts) plus our own file storage; connections to
 * the services we actually use. Inline scripts/styles are permitted
 * because Next.js and the editor rely on them; `unsafe-eval` only outside
 * production builds.
 */
const isProduction = process.env.NODE_ENV === "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.liveblocks.io wss://*.liveblocks.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://vercel.live wss://*.pusher.com",
  "frame-src 'self' https://www.youtube-nocookie.com https://drive.google.com https://docs.google.com https://*.supabase.co",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallback.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallback.anonKey,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
