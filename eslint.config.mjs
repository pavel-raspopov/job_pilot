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
    // Agent tooling vendored from other harnesses (.agents, .cursor) and the
    // Claude Code copies of it. Third-party skill scripts, not project source.
    ".agents/**",
    ".cursor/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
