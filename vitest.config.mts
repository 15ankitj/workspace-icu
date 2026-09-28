import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    // Pack authoring (content/) and its build (scripts/) are tested too.
    include: [
      "src/**/*.test.ts",
      "scripts/**/*.test.ts",
      "content/**/*.test.ts",
    ],
    environment: "node",
  },
});
