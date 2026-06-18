import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/diagnostics-core": resolve(currentDir, "../diagnostics-core/src/index.ts"),
      "@croco/events-core": resolve(currentDir, "../events-core/src/index.ts"),
      "@croco/events-inmemory": resolve(currentDir, "../events-inmemory/src/index.ts"),
      "@croco/framework-context": resolve(currentDir, "../framework-context/src/index.ts"),
      "@croco/framework-logger": resolve(currentDir, "../framework-logger/src/index.ts"),
      "@croco/health-core": resolve(currentDir, "../health-core/src/index.ts"),
      "@croco/llm-core": resolve(currentDir, "../llm-core/src/index.ts"),
      "@croco/openapi-spec": resolve(currentDir, "../openapi-spec/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/protocols-core": resolve(currentDir, "../protocols-core/src/index.ts"),
      "@croco/protocols-rest": resolve(currentDir, "../protocols-rest/src/index.ts"),
      "@croco/ratelimit-core": resolve(currentDir, "../ratelimit-core/src/index.ts"),
      "@croco/storage-core": resolve(currentDir, "../storage-core/src/index.ts"),
      "@croco/telemetry-api": resolve(currentDir, "../telemetry-api/src/index.ts"),
      "@croco/transports-http": resolve(currentDir, "../transports-http/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
