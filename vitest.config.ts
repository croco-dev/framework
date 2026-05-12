import { defineConfig } from "vitest/config";

export const CORE_COVERAGE_PACKAGES = [
  "@croco/framework-context",
  "@croco/retry-core",
  "@croco/events-core",
  "@croco/auth-core",
  "@croco/telemetry-api",
];

export const CORE_COVERAGE_THRESHOLDS = {
  lines: 60,
  branches: 60,
  functions: 60,
  statements: 60,
};

const isCoreCoverageRun = process.env.CORE_COVERAGE === "true";
const coreCoveragePackagePaths = CORE_COVERAGE_PACKAGES.map((packageName) =>
  packageName.replace("@croco/", "packages/"),
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
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
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
