import { describe, expect, it } from "vitest";

import {
  collectStrictContractDiagnostics,
  compareStrictContractDiagnostics,
  normalizeStrictContractDiagnostics,
  validateStrictContractBaselineConfiguration,
  type StrictContractBaseline,
  type StrictContractPackage,
} from "../strict-contract-typecheck.mts";

const protocolsCorePackage: StrictContractPackage = {
  name: "@croco/protocols-core",
  path: "packages/protocols-core",
  tsconfig: "packages/protocols-core/tsconfig.contract-strict.json",
};

describe("strict-contract-typecheck.mts", () => {
  it("normalizes diagnostics for the rollout package and filters dependency diagnostics", () => {
    const diagnostics = normalizeStrictContractDiagnostics(
      "/repo",
      protocolsCorePackage,
      [
        "packages/problems-core/src/libs/Problem.ts(56,5): error TS2412: dependency strict diagnostic",
        "packages/protocols-core/src/libs/ContractGraph.ts(183,3): error TS2322: target strict diagnostic",
        "",
      ].join("\n"),
    );

    expect(diagnostics).toEqual([
      {
        packageName: "@croco/protocols-core",
        file: "packages/protocols-core/src/libs/ContractGraph.ts",
        line: 183,
        column: 3,
        code: "TS2322",
        message: "target strict diagnostic",
      },
    ]);
  });

  it("reports added and removed diagnostics relative to the baseline", () => {
    const baseline = [
      {
        packageName: "@croco/protocols-core",
        file: "packages/protocols-core/src/libs/ContractGraph.ts",
        line: 183,
        column: 3,
        code: "TS2322",
        message: "baseline diagnostic",
      },
    ];
    const current = [
      {
        packageName: "@croco/protocols-core",
        file: "packages/protocols-core/src/libs/ContractGraphSnapshot.ts",
        line: 114,
        column: 11,
        code: "TS4111",
        message: "new diagnostic",
      },
    ];

    expect(compareStrictContractDiagnostics(baseline, current)).toEqual({
      added: current,
      removed: baseline,
    });
  });

  it("keeps global compiler diagnostics fatal while filtering dependency file diagnostics", () => {
    const diagnostics = collectStrictContractDiagnostics(
      "/repo",
      protocolsCorePackage,
      [
        "packages/problems-core/src/libs/Problem.ts(56,5): error TS2412: dependency strict diagnostic",
        "  Type 'undefined' is not assignable to type 'string'.",
        "error TS18003: No inputs were found in config file '/repo/packages/protocols-core/tsconfig.contract-strict.json'.",
        "",
      ].join("\n"),
    );

    expect(diagnostics).toEqual({
      targetDiagnostics: [],
      fatalDiagnostics: [
        "error TS18003: No inputs were found in config file '/repo/packages/protocols-core/tsconfig.contract-strict.json'.",
      ],
    });
  });

  it("ignores pnpm config warnings emitted around baseline TypeScript diagnostics", () => {
    const diagnostics = collectStrictContractDiagnostics(
      "/repo",
      protocolsCorePackage,
      [
        '[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides", "pnpm.auditConfig". See https://pnpm.io/settings for the new home of each setting.',
        "packages/protocols-core/src/libs/ContractGraph.ts(183,3): error TS2322: target strict diagnostic",
        "",
      ].join("\n"),
    );

    expect(diagnostics).toEqual({
      targetDiagnostics: [
        {
          packageName: "@croco/protocols-core",
          file: "packages/protocols-core/src/libs/ContractGraph.ts",
          line: 183,
          column: 3,
          code: "TS2322",
          message: "target strict diagnostic",
        },
      ],
      fatalDiagnostics: [],
    });
  });

  it("accepts baseline metadata that matches the strict rollout configuration", () => {
    expect(() => validateStrictContractBaselineConfiguration(validBaseline())).not.toThrow();
  });

  it("rejects stale baseline metadata before comparing diagnostics", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration({
        ...validBaseline(),
        strictOptions: ["exactOptionalPropertyTypes"],
      }),
    ).toThrow(/Baseline strictOptions mismatch/);

    expect(() =>
      validateStrictContractBaselineConfiguration({
        ...validBaseline(),
        packages: ["@croco/protocols-rest"],
      }),
    ).toThrow(/Baseline packages mismatch/);
  });
});

function validBaseline(): StrictContractBaseline {
  return {
    version: 1,
    strictOptions: [
      "exactOptionalPropertyTypes",
      "noUncheckedIndexedAccess",
      "noPropertyAccessFromIndexSignature",
    ],
    packages: ["@croco/protocols-core"],
    diagnostics: [],
  };
}
