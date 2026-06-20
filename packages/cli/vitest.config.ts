import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/execution-core": resolve(currentDir, "../execution-core/src/index.ts"),
      "@croco/migration-runner": resolve(currentDir, "../migration-runner/src/index.ts"),
      "@croco/openapi-spec": resolve(currentDir, "../openapi-spec/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/protocols-core": resolve(currentDir, "../protocols-core/src/index.ts"),
      "@croco/rpc-codegen": resolve(currentDir, "../rpc-codegen/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["src/tests/integration/**", "**/node_modules/**", "**/dist/**"],
  },
});
