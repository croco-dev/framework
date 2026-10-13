import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    alias: {
      "@croco/research-core": resolve(__dirname, "../research-core/src/index.ts"),
      "@croco/engagement-core": resolve(__dirname, "../engagement-core/src/index.ts"),
      "@croco/problems-core": resolve(__dirname, "../problems-core/src/index.ts"),
    },
  },
});
