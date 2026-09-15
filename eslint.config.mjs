import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived pre-migration vanilla JS app — not part of the Next.js app.
    "legacy-vanilla-app/**",
    // One-off Node/CommonJS data-scraping scripts — not part of the app bundle.
    "scripts/generate-bangalore-pgs.js",
    "scripts/generate-india-pgs.js",
  ]),
]);

export default eslintConfig;
