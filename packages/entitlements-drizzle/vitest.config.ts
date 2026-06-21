import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    alias: {
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
    },
    testTimeout: 10000,
    setupFiles: ["./vitest.setup.ts"],
  },
});
