import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@croco/execution-core": resolve(__dirname, "../execution-core/src/index.ts"),
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
      "@croco/testing": resolve(__dirname, "../testing/src/libs/drizzle-provider-conformance.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
  },
});
