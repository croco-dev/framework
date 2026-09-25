import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@croco/admin-core/fact-history-validation": resolve(
        currentDir,
        "src/fact-history-validation.ts",
      ),
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
