import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/execution-core": resolve(currentDir, "../execution-core/src/index.ts"),
      "@croco/framework-context": resolve(currentDir, "../framework-context/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/testing": resolve(
        currentDir,
        "../testing/src/libs/serverless-provider-conformance.ts",
      ),
      "@croco/triggers-core": resolve(currentDir, "../triggers-core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/tests/**/*.spec.ts"],
  },
});
