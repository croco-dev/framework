import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@croco/framework-preset": resolve(__dirname, "../framework-preset/src/index.ts"),
    },
  },
});
