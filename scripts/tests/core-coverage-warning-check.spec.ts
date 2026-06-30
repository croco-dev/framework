import { describe, expect, it } from "vitest";

import type { CoverageTotals } from "../core-coverage-warning-check.mts";
import {
  getCoreCoverageSelectionCandidates,
  getCoreCoverageSelectionWarnings,
  getBaselineWarnings,
  parseBaselineContent,
  validateBaselineEntries,
} from "../core-coverage-warning-check.mts";

describe("core-coverage-warning-check.mts", () => {
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
