import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/events-core": resolve(currentDir, "../events-core/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/telemetry-api": resolve(currentDir, "../telemetry-api/src/index.ts"),
      "@croco/tx-core": resolve(currentDir, "../tx-core/src/index.ts"),
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
