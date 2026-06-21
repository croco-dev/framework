import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@croco/framework-context": resolve(__dirname, "../framework-context/src/index.ts"),
      "@croco/framework-logger": resolve(__dirname, "../framework-logger/src/index.ts"),
      "@croco/metering-core": resolve(__dirname, "../metering-core/src/index.ts"),
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
      "@croco/telemetry-api": resolve(__dirname, "../telemetry-api/src/index.ts"),
      "@croco/testing": resolve(__dirname, "../testing/src/libs/drizzle-provider-conformance.ts"),
      "@croco/tx-core": resolve(__dirname, "../tx-core/src/index.ts"),
      "@croco/tx-drizzle": resolve(__dirname, "../tx-drizzle/src/index.ts"),
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
