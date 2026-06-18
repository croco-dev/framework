import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@croco/framework-context": resolve(__dirname, "../framework-context/src/index.ts"),
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
      "@croco/protocols-core": resolve(__dirname, "../protocols-core/src/index.ts"),
      "@croco/protocols-rest": resolve(__dirname, "../protocols-rest/src/index.ts"),
    },
  },
});
