import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/[A-Z]*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
  },
});
