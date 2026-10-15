import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      graphql: fileURLToPath(new URL("./node_modules/graphql/index.js", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10000,
  },
});
