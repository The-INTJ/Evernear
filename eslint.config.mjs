// ESLint flat config. Core rules + `no-restricted-imports` boundaries
// matching the runtime-boundary table in CLAUDE.md + AGENT.md:
//
//   src/renderer/ may not import from src/db/, src/main/, better-sqlite3,
//                  or electron (the preload bridge lives on window).
//   src/preload/  may not import from src/db/ or src/renderer/.
//   src/db/       may not import from src/main/ or src/renderer/.
//   src/shared/   may not import platform-specific packages.
//
// Adjust the forbidden-import patterns here if the boundary moves.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-electron/**",
      "coverage/**",
      "node_modules/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "off", // we use !. judiciously
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // ─────────────── boundary enforcement ───────────────
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/db/**"], message: "Renderer must not import from src/db/. Use the preload bridge (window.evernear)." },
          { group: ["**/main/**"], message: "Renderer must not import from src/main/." },
          { group: ["better-sqlite3"], message: "Renderer must not import better-sqlite3." },
          { group: ["electron"], message: "Renderer uses window.evernear; never import electron directly." },
        ],
      }],
    },
  },
  {
    files: ["src/preload/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/db/**"], message: "Preload is a thin forwarder; do not import src/db/." },
          { group: ["**/renderer/**"], message: "Preload must not import from src/renderer/." },
        ],
      }],
    },
  },
  {
    files: ["src/main/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/renderer/**"], message: "Main must not import from src/renderer/." },
        ],
      }],
    },
  },
  {
    files: ["src/db/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/main/**"], message: "DB must not import from src/main/." },
          { group: ["**/renderer/**"], message: "DB must not import from src/renderer/." },
          { group: ["electron"], message: "DB must not import electron." },
        ],
      }],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["better-sqlite3"], message: "Shared must not depend on SQLite." },
          { group: ["electron"], message: "Shared must not depend on electron." },
          { group: ["react", "react-dom"], message: "Shared must not depend on React." },
          { group: ["**/db/**"], message: "Shared must not reach into the DB layer." },
          { group: ["**/main/**"], message: "Shared must not reach into main." },
          { group: ["**/renderer/**"], message: "Shared must not reach into the renderer." },
        ],
      }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-restricted-imports": "off",
    },
  },
);
