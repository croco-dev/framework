import { resolve } from "node:path";

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

const repositoryRoot = __dirname;
const isCoreCoverageRun = process.env.CORE_COVERAGE === "true";
const coreCoveragePackagePaths = CORE_COVERAGE_PACKAGES.map(
  (packageName) => `packages/${packageName.replace("@croco/", "")}`,
);
const currentWorkingDirectory = process.cwd().replace(/\\/g, "/");
const isFrameworkContextPackageRun = currentWorkingDirectory.endsWith("packages/framework-context");
const isTestingPackageRun = currentWorkingDirectory.endsWith("packages/testing");
const isTxDrizzlePackageRun = currentWorkingDirectory.endsWith("packages/tx-drizzle");
const shouldExcludeCliIntegrationTestsFromCoreCoverage =
  isCoreCoverageRun && currentWorkingDirectory.endsWith("packages/cli");
const shouldApplyCoreCoverageThresholds =
  isCoreCoverageRun &&
  coreCoveragePackagePaths.some((packagePath) => currentWorkingDirectory.endsWith(packagePath));

const coverageThresholds = shouldApplyCoreCoverageThresholds ? CORE_COVERAGE_THRESHOLDS : undefined;
const frameworkContextPackageAliases = isFrameworkContextPackageRun
  ? {
      "@croco/problems-core": resolve(currentWorkingDirectory, "../problems-core/src/index.ts"),
    }
  : {};
const testingPackageAliases = isTestingPackageRun
  ? {
      "@croco/testing/drizzle": resolve(currentWorkingDirectory, "src/drizzle.ts"),
      "@croco/testing": resolve(currentWorkingDirectory, "src/index.ts"),
    }
  : {};
const txDrizzlePackageAliases = isTxDrizzlePackageRun
  ? {
      "@croco/dataloader-core": resolve(currentWorkingDirectory, "../dataloader-core/src/index.ts"),
    }
  : {};

export default defineConfig({
  resolve: {
    alias: {
      "@croco/problems-core": resolve(repositoryRoot, "packages/problems-core/src/index.ts"),
      "@croco/tenant-core/tenant-model": resolve(
        repositoryRoot,
        "packages/tenant-core/src/tenant-model.ts",
      ),
      ...frameworkContextPackageAliases,
      ...testingPackageAliases,
      ...txDrizzlePackageAliases,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "scripts/tests/**/*.spec.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      ...(shouldExcludeCliIntegrationTestsFromCoreCoverage ? ["src/tests/integration/**"] : []),
    ],
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
