import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/ratelimit-core": resolve(currentDir, "../ratelimit-core/src/index.ts"),
      "@croco/testing": resolve(
        currentDir,
        "../testing/src/libs/serverless-provider-conformance.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
    passWithNoTests: true,
  },
});
