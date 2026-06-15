import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/problems-core": resolve(currentDir, "packages/problems-core/src/index.ts"),
    },
  },
  test: {
    fileParallelism: false,
    testTimeout: 120_000,
    benchmark: {
      include: ["packages/**/src/tests/*.bench.ts"],
      reporters: ["default"],
    },
  },
});
