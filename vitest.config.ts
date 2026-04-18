import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts", "src/**/*.{test,spec}.tsx"],
    // Tests that use better-sqlite3 need a real Node loader, not jsdom.
    // If/when renderer tests land, add a second project config (vitest
    // supports `projects`) rather than flipping the global environment.
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/vite-env.d.ts"],
    },
  },
});
