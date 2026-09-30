import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Server actions return results, never throw: in production Next.js
  // masks a thrown action error behind a digest, so a thrown message is
  // one the user never sees (src/lib/action-result.ts).
  {
    files: ["src/app/actions/**/*.ts"],
    ignores: ["src/app/actions/**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement",
          message:
            "Server actions return ActionResult (src/lib/action-result.ts); do not throw.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
