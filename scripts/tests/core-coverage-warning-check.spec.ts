import { describe, expect, it } from "vitest";

import type { CoverageTotals } from "../core-coverage-warning-check.mts";
import {
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
});

function coverageTotals(values: Record<keyof CoverageTotals, number>): CoverageTotals {
  return {
    branches: { pct: values.branches },
    functions: { pct: values.functions },
    lines: { pct: values.lines },
    statements: { pct: values.statements },
  };
}
