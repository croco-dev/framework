import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/diagnostics-core": resolve(currentDir, "../diagnostics-core/src/index.ts"),
      "@croco/execution-core": resolve(currentDir, "../execution-core/src/index.ts"),
      "@croco/lifecycle-core": resolve(currentDir, "../lifecycle-core/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
  },
});
