import { defineConfig } from "@playwright/test";

/**
 * Smoke tests against a production build (brief §12, "Playwright smoke
 * tests"). They run without a database: placeholder Supabase values make
 * every page render but no query succeed, so tests stick to routes that
 * never need one. Editor and collaboration flows need real credentials
 * and are exercised on the staging deployment instead.
 */
const PORT = 3400;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
    },
  },
});
