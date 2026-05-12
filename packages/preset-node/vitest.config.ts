import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@croco/framework-preset": "../framework-preset/src/index.ts",
    },
  },
});
