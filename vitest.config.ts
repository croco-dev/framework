import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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

export const CORE_COVERAGE_BASELINE_PATH = resolve("ci-reports", "coverage", "core-baseline.txt");

const isCoreCoverageRun = process.env.CORE_COVERAGE === "true";
const coreCoveragePackagePaths = CORE_COVERAGE_PACKAGES.map((packageName) =>
  packageName.replace("@croco/", "packages/"),
);
const currentWorkingDirectory = process.cwd().replace(/\\/g, "/");
const shouldApplyCoreCoverageThresholds =
  isCoreCoverageRun &&
  coreCoveragePackagePaths.some((packagePath) => currentWorkingDirectory.endsWith(packagePath));

let perPackageThresholds:
  | Record<string, { lines: number; branches: number; functions: number; statements: number }>
  | undefined;
if (isCoreCoverageRun) {
  try {
    const baselinePath = CORE_COVERAGE_BASELINE_PATH;
    if (existsSync(baselinePath)) {
      const content = readFileSync(baselinePath, "utf-8");
      const lines = content.split("\n");
      perPackageThresholds = {};
      for (const line of lines) {
        const match = line.match(
          /\| `(@croco\/[^`]+)`\s*\| (\d+)\s*\| (\d+)\s*\| (\d+)\s*\| (\d+)\s*\|/,
        );
        if (match) {
          perPackageThresholds[match[1]] = {
            statements: Number(match[2]),
            branches: Number(match[3]),
            functions: Number(match[4]),
            lines: Number(match[5]),
          };
        }
      }
    }
  } catch {
    // baseline file not available, fall back to global thresholds
  }
}

const currentPackageName = `@croco/${currentWorkingDirectory.split("/packages/")[1]}`;
const coverageThresholds = shouldApplyCoreCoverageThresholds
  ? (perPackageThresholds?.[currentPackageName] ?? CORE_COVERAGE_THRESHOLDS)
  : undefined;

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
