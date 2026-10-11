import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/etl-core/source": resolve(currentDir, "../etl-core/src/source.ts"),
      "@croco/events-tx": resolve(currentDir, "../events-tx/src/index.ts"),
      "@croco/events-core": resolve(currentDir, "../events-core/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/telemetry-api": resolve(currentDir, "../telemetry-api/src/index.ts"),
      "@croco/tx-core": resolve(currentDir, "../tx-core/src/index.ts"),
      "@croco/warehouse-core/runtime": resolve(currentDir, "../warehouse-core/src/runtime.ts"),
      "@croco/warehouse-core": resolve(currentDir, "../warehouse-core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/tests/**/*.spec.ts"],
  },
});
