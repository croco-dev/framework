import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/diagnostics-core": resolve(currentDir, "../diagnostics-core/src/index.ts"),
      "@croco/framework-context": resolve(currentDir, "../framework-context/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/retry-core": resolve(currentDir, "../retry-core/src/index.ts"),
      "@croco/storage-core": resolve(currentDir, "../storage-core/src/index.ts"),
      "@croco/telemetry-api": resolve(currentDir, "../telemetry-api/src/index.ts"),
      "@croco/testing": resolve(currentDir, "../testing/src/libs/provider-conformance.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.spec.ts"],
  },
});
