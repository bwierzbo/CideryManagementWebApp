// Root ESLint flat config (ESLint 9) for all workspace packages,
// including apps/web (Next 15.5 removed `next lint`, so web runs plain
// eslint against this config too).
//
// Baseline: TypeScript-aware parsing with a minimal rule set so CI lint
// runs and stays meaningful (it catches parse errors and obvious bugs).
// Tighten incrementally rather than turning on a full preset at once —
// the codebase predates linting.
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
      "analysis/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    // Plugins are registered (with no rules enabled yet) so existing
    // eslint-disable comments that reference their rules still resolve.
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "no-debugger": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
];
