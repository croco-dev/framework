import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/metering-core": resolve(currentDir, "../metering-core/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
      "@croco/testing": resolve(
        currentDir,
        "../testing/src/libs/serverless-provider-conformance.ts",
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
  },
});
