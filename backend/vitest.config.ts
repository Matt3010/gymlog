import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Database tests make and migrate a Postgres database of their own: slower than the rest.
    testTimeout: 20_000,
  },
});
