import { defineConfig } from "vitest/config";

export const CORE_COVERAGE_PACKAGES = [
  "@croco/framework-context",
  "@croco/retry-core",
  "@croco/events-core",
  "@croco/auth-core",
  "@croco/telemetry-api",
];

export const CORE_COVERAGE_BASELINE_PATH = "ci-reports/coverage/core-baseline.txt";

export const CORE_COVERAGE_THRESHOLDS = {
  statements: 0,
  branches: 0,
  functions: 0,
  lines: 0,
};

const coverageThresholds = undefined;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "scripts/tests/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/*.spec.ts"],
      thresholds: coverageThresholds,
    },
    testTimeout: 10000,
    pool: "threads",
  },
});
