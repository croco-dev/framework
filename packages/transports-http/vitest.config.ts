import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
      "@croco/ratelimit-core": resolve(__dirname, "../ratelimit-core/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
    env: {
      CROCO_HTTP_DI_VALIDATION: "off",
      CROCO_HTTP_SECURITY_VALIDATION: "off",
    },
  },
});
