import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120_000,
    benchmark: {
      include: ["packages/**/src/tests/*.bench.ts"],
      reporters: ["default"],
    },
  },
});
