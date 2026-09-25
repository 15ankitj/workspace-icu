import { defineConfig } from "@playwright/test";

/**
 * Staging end-to-end runs against a Vercel Preview deployment (Appendix B
 * §6): no local server, real accounts from the STAGING_* environment, one
 * worker so the scenarios' shared data stays in order. The specs skip
 * themselves when the environment is missing.
 *
 *   npm run e2e:staging
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: /relations\.spec\.ts$/,
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.STAGING_URL,
    browserName: "chromium",
    trace: "retain-on-failure",
    // Behind a corporate or sandbox egress proxy the browser needs telling;
    // Node's own fetch follows the same variable with NODE_USE_ENV_PROXY=1.
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY }
      : undefined,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
});
