import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/analytics-core/acquisition": resolve(
        currentDir,
        "../analytics-core/src/acquisition.ts",
      ),
      "@croco/research-core": resolve(currentDir, "../research-core/src/index.ts"),
      "@croco/metrics-core/runtime": resolve(currentDir, "../metrics-core/src/runtime.ts"),
      "@croco/metrics-core": resolve(currentDir, "../metrics-core/src/index.ts"),
      "@croco/engagement-core": resolve(currentDir, "../engagement-core/src/index.ts"),
      "@croco/features-core": resolve(currentDir, "../features-core/src/index.ts"),
      "@croco/admin-core/fact-history-validation": resolve(
        currentDir,
        "src/fact-history-validation.ts",
      ),
      "@croco/admin-core": resolve(currentDir, "src/index.ts"),
      "@croco/analytics-core": resolve(currentDir, "../analytics-core/src/index.ts"),
      "@croco/problems-core": resolve(currentDir, "../problems-core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    include: ["src/**/*.spec.ts"],
    testTimeout: 10000,
  },
});
