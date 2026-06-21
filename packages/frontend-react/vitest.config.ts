import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
  },
});
