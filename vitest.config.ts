import { defineConfig } from "vitest/config";

export const CORE_COVERAGE_PACKAGES = [
  "@croco/framework-context",
  "@croco/problems-core",
  "@croco/protocols-core",
  "@croco/protocols-rest",
  "@croco/openapi-spec",
  "@croco/rpc-codegen",
  "@croco/transports-http",
  "@croco/telemetry-api",
  "@croco/telemetry-sdk-node",
  "@croco/tx-core",
  "@croco/tx-drizzle",
  "@croco/events-core",
  "@croco/events-tx",
  "@croco/retry-core",
  "@croco/idempotency-core",
  "@croco/testing",
  "create-croco-app",
  "@croco/cli",
  "@croco/auth-core",
];

export const CORE_COVERAGE_BASELINE_PATH = "ci-reports/coverage/core-baseline.txt";

export const CORE_COVERAGE_THRESHOLDS = {
  lines: 60,
  branches: 60,
  functions: 60,
  statements: 60,
};

const isCoreCoverageRun = process.env.CORE_COVERAGE === "true";
const coreCoveragePackagePaths = CORE_COVERAGE_PACKAGES.map(
  (packageName) => `packages/${packageName.replace("@croco/", "")}`,
);
const currentWorkingDirectory = process.cwd().replace(/\\/g, "/");
const shouldApplyCoreCoverageThresholds =
  isCoreCoverageRun &&
  coreCoveragePackagePaths.some((packagePath) => currentWorkingDirectory.endsWith(packagePath));

const coverageThresholds = shouldApplyCoreCoverageThresholds ? CORE_COVERAGE_THRESHOLDS : undefined;

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
