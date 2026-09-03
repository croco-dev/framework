import { describe, expect, it } from "vitest";

import {
  CORE_COVERAGE_PACKAGE_DIRECTORIES,
  CORE_COVERAGE_PACKAGES,
  defineCoreCoveragePackages,
  isCoreCoveragePackageDirectory,
} from "../core-coverage-config.mts";
import type { CoverageTotals } from "../core-coverage-warning-check.mts";
import {
  getCoreCoverageSelectionCandidates,
  getCoreCoverageSelectionWarnings,
  getCoreCoverageConfigurationErrors,
  getBaselineWarnings,
  parseBaselineContent,
  parseCoreCoverageThresholds,
  parseCoreCoveragePackageFilters,
  resolveCoreCoveragePackageFilters,
  validateBaselineEntries,
} from "../core-coverage-warning-check.mts";
import { getVerificationCommand } from "../verification-manifest.mts";

describe("core-coverage-warning-check.mts", () => {
  it("keeps core coverage ownership valid and aligned across local and CI selection", () => {
    expect(CORE_COVERAGE_PACKAGE_DIRECTORIES).toHaveLength(CORE_COVERAGE_PACKAGES.length);
    expect(
      parseCoreCoveragePackageFilters(getVerificationCommand("core-coverage").command.join(" ")),
    ).toEqual(CORE_COVERAGE_PACKAGES);
  });

  it("rejects duplicate or nonexistent core coverage package ownership", () => {
    expect(() =>
      defineCoreCoveragePackages([...CORE_COVERAGE_PACKAGES, CORE_COVERAGE_PACKAGES[0]]),
    ).toThrow("duplicate core coverage package");
    expect(() => defineCoreCoveragePackages(["@croco/nonexistent-core-package"])).toThrow(
      "does not map to an existing workspace directory",
    );
  });

  it("applies core coverage threshold ownership to every selected workspace only", () => {
    for (const directory of CORE_COVERAGE_PACKAGE_DIRECTORIES) {
      expect(isCoreCoveragePackageDirectory(`/workspace/packages/${directory}`), directory).toBe(
        true,
      );
    }
    expect(isCoreCoveragePackageDirectory("/workspace/packages/tenant-core")).toBe(false);
  });

  it("reports package coverage drops below the committed baseline", () => {
    const baseline = parseBaselineContent(`
| Package | Statements | Branches | Functions | Lines |
|---------|-----------:|---------:|----------:|------:|
| \`@croco/example-core\` | 90 | 85 | 95 | 92 |
`);

    const warnings = getBaselineWarnings(
      "@croco/example-core",
      coverageTotals({ statements: 89, branches: 85, functions: 94, lines: 91.5 }),
      baseline,
    );

    expect(warnings).toEqual([
      "statements 89.00% < baseline 90.00%",
      "functions 94.00% < baseline 95.00%",
      "lines 91.50% < baseline 92.00%",
    ]);
  });

  it("parses unscoped public package baseline rows", () => {
    const baseline = parseBaselineContent(`
| Package | Statements | Branches | Functions | Lines |
|---------|-----------:|---------:|----------:|------:|
| \`create-croco-app\` | 80 | 70 | 90 | 82 |
`);

    const warnings = getBaselineWarnings(
      "create-croco-app",
      coverageTotals({ statements: 80, branches: 70, functions: 90, lines: 82 }),
      baseline,
    );

    expect(warnings).toEqual([]);
  });

  it("ignores prerequisite build filters when reading the core coverage package set", () => {
    const packages = parseCoreCoveragePackageFilters(
      "pnpm --filter @croco/problems-core build && CORE_COVERAGE=true pnpm --filter @croco/framework-context --filter create-croco-app exec vitest run",
    );

    expect(packages).toEqual(["@croco/framework-context", "create-croco-app"]);
  });

  it("parses quoted core coverage package filters", () => {
    const packages = parseCoreCoveragePackageFilters(
      "CORE_COVERAGE=true pnpm --filter \"@croco/framework-context\" --filter 'create-croco-app' exec vitest run",
    );

    expect(packages).toEqual(["@croco/framework-context", "create-croco-app"]);
  });

  it("resolves core coverage filters through the authoritative dispatcher", () => {
    const packages = resolveCoreCoveragePackageFilters(
      "pnpm --filter @croco/problems-core build && node --experimental-strip-types scripts/verification-command.mts --id core-coverage",
    );

    expect(packages).toContain("@croco/framework-context");
    expect(packages).toContain("create-croco-app");
    expect(packages).not.toContain("@croco/tenant-core");
  });

  it("rejects a dispatcher whose command has no core coverage filters", () => {
    expect(() =>
      resolveCoreCoveragePackageFilters(
        "pnpm --filter @croco/problems-core build && node --experimental-strip-types scripts/verification-command.mts --id first-success",
      ),
    ).toThrow("failed to read core coverage package filters");
  });

  it("parses semicolonless core coverage threshold exports", () => {
    expect(
      parseCoreCoverageThresholds(
        `
export const CORE_COVERAGE_THRESHOLDS = {
  lines: 80,
  branches: 81,
  functions: 82,
  statements: 83,
}
`,
      ),
    ).toEqual({
      lines: 80,
      branches: 81,
      functions: 82,
      statements: 83,
    });
  });

  it("uses the provided source label when threshold parsing fails", () => {
    expect(() =>
      parseCoreCoverageThresholds(
        "export const OTHER_COVERAGE_THRESHOLDS = {};",
        "inline vitest config",
      ),
    ).toThrow("failed to read core coverage config from inline vitest config");
  });

  it("rejects zero baseline metrics when a coverage summary exists", () => {
    const baseline = parseBaselineContent(`
| Package | Statements | Branches | Functions | Lines |
|---------|-----------:|---------:|----------:|------:|
| \`@croco/example-core\` | 0 | 0 | 0 | 0 |
`);

    const errors = validateBaselineEntries(
      [
        {
          packageName: "@croco/example-core",
          totals: coverageTotals({ statements: 80, branches: 70, functions: 90, lines: 82 }),
        },
      ],
      baseline,
    );

    expect(errors).toEqual([
      expect.stringContaining(
        "@croco/example-core: baseline statements, branches, functions, lines cannot be 0",
      ),
    ]);
  });

  it("allows explicitly documented zero baseline bootstrap exceptions", () => {
    const baseline = parseBaselineContent(`
| Package | Statements | Branches | Functions | Lines |
|---------|-----------:|---------:|----------:|------:|
| \`@croco/example-core\` | 0 | 0 | 0 | 0 |
`);

    const errors = validateBaselineEntries(
      [
        {
          packageName: "@croco/example-core",
          totals: coverageTotals({ statements: 0, branches: 0, functions: 0, lines: 0 }),
        },
      ],
      baseline,
      {
        "@croco/example-core": "bootstrap package has no executable source yet",
      },
    );

    expect(errors).toEqual([]);
  });

  it("reports release-critical candidates that are missing from the core coverage set", () => {
    const candidates = getCoreCoverageSelectionCandidates({
      catalog: {
        groups: {
          Core: { packages: ["health-core", "retry-core"] },
          Domain: { packages: ["billing-core"] },
        },
        maturity: {
          production: { packages: ["billing-core", "retry-core"] },
          beta: { packages: ["health-core"] },
        },
        spine: {
          packages: ["billing-core"],
        },
      },
      workspacePackageNames: new Set([
        "@croco/billing-core",
        "@croco/health-core",
        "@croco/retry-core",
      ]),
      coreCoveragePackages: ["@croco/retry-core"],
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        packageName: "@croco/billing-core",
        status: "missing",
        signals: ["1.0 spine package", "production-ready maturity"],
      }),
      expect.objectContaining({
        packageName: "@croco/health-core",
        status: "missing",
        signals: ["catalog group: Core", "health/readiness contract"],
      }),
      expect.objectContaining({
        packageName: "@croco/retry-core",
        status: "included",
        signals: ["catalog group: Core", "production-ready maturity", "retry/reliability contract"],
      }),
    ]);
    expect(getCoreCoverageSelectionWarnings(candidates)).toEqual([
      expect.stringContaining("@croco/billing-core: candidate signals"),
      expect.stringContaining("@croco/health-core: candidate signals"),
    ]);
  });

  it("reports beta spine packages as deterministic coverage candidates", () => {
    const candidates = getCoreCoverageSelectionCandidates({
      catalog: {
        groups: {
          Tooling: { packages: ["create-croco-app"] },
        },
        maturity: {
          beta: { packages: ["create-croco-app"] },
        },
        spine: {
          packages: ["create-croco-app"],
        },
      },
      workspacePackageNames: new Set(["create-croco-app"]),
      coreCoveragePackages: [],
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        packageName: "create-croco-app",
        status: "missing",
        signals: ["1.0 spine package"],
      }),
    ]);
    expect(getCoreCoverageSelectionWarnings(candidates)).toEqual([
      expect.stringContaining("create-croco-app: candidate signals"),
    ]);
  });

  it("fails configuration checks for missing spine and coverage-threshold drift", () => {
    const candidates = getCoreCoverageSelectionCandidates({
      catalog: {
        spine: {
          packages: ["framework-context", "create-croco-app"],
        },
      },
      workspacePackageNames: new Set(["@croco/framework-context", "create-croco-app"]),
      coreCoveragePackages: ["@croco/framework-context"],
    });

    expect(
      getCoreCoverageConfigurationErrors({
        coreCoveragePackages: ["@croco/framework-context", "@croco/auth-core"],
        thresholdPackages: ["@croco/framework-context", "create-croco-app"],
        selectionCandidates: candidates,
      }),
    ).toEqual([
      expect.stringContaining("create-croco-app: 1.0 spine package must be included"),
      expect.stringContaining("@croco/auth-core: test:coverage:core package is missing"),
      expect.stringContaining("create-croco-app: shared core coverage config entry is missing"),
    ]);
  });

  it("keeps temporary selection exclusions visible without counting them as missing warnings", () => {
    const candidates = getCoreCoverageSelectionCandidates({
      catalog: {
        groups: {
          Transport: { packages: ["transports-http"] },
        },
        maturity: {},
      },
      workspacePackageNames: new Set(["@croco/transports-http"]),
      coreCoveragePackages: [],
      temporaryExclusions: {
        "@croco/transports-http":
          "coverage migration tracked separately until adapter fixtures land",
      },
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        packageName: "@croco/transports-http",
        status: "temporarily-excluded",
        exclusionReason: "coverage migration tracked separately until adapter fixtures land",
        signals: ["catalog group: Transport", "transport runtime contract"],
      }),
    ]);
    expect(getCoreCoverageSelectionWarnings(candidates)).toEqual([]);
  });
});

function coverageTotals(values: Record<keyof CoverageTotals, number>): CoverageTotals {
  return {
    branches: { pct: values.branches },
    functions: { pct: values.functions },
    lines: { pct: values.lines },
    statements: { pct: values.statements },
  };
}
