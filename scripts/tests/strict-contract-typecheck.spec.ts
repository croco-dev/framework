import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectStrictContractDiagnostics,
  compareStrictContractDiagnostics,
  normalizeStrictContractDiagnostics,
  validateStrictContractBaselineConfiguration,
  validateStrictContractPackageConfigurations,
  type StrictContractBaseline,
  type StrictContractPackage,
} from "../strict-contract-typecheck.mts";

const protocolsCorePackage: StrictContractPackage = {
  name: "@croco/protocols-core",
  path: "packages/protocols-core",
  tsconfig: "packages/protocols-core/tsconfig.contract-strict.json",
};

const protocolsRestPackage: StrictContractPackage = {
  name: "@croco/protocols-rest",
  path: "packages/protocols-rest",
  tsconfig: "packages/protocols-rest/tsconfig.contract-strict.json",
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

  it("requires deferral metadata for every package with accepted diagnostics", () => {
    const diagnostic = {
      packageName: "@croco/protocols-rest",
      file: "packages/protocols-rest/src/libs/types.ts",
      line: 10,
      column: 3,
      code: "TS2375",
      message: "accepted strict diagnostic",
    };

    expect(() =>
      validateStrictContractBaselineConfiguration({
        ...validBaseline(),
        diagnostics: [diagnostic],
      }),
    ).toThrow(/require deferral metadata/);

    expect(() =>
      validateStrictContractBaselineConfiguration({
        ...validBaseline(),
        deferrals: [
          {
            packageName: "@croco/protocols-rest",
            reason: "Tracked as a staged package migration.",
            owner: "@croco/core",
          },
        ],
        diagnostics: [diagnostic],
      }),
    ).not.toThrow();
  });

  it("rejects deferrals without complete owner and reason metadata", () => {
    const baseline = {
      ...validBaseline(),
      deferrals: [
        {
          packageName: "@croco/protocols-rest",
          reason: "",
          owner: "@croco/core",
        },
      ],
      diagnostics: [
        {
          packageName: "@croco/protocols-rest",
          file: "packages/protocols-rest/src/libs/types.ts",
          line: 10,
          column: 3,
          code: "TS2375",
          message: "accepted strict diagnostic",
        },
      ],
    };

    expect(() => validateStrictContractBaselineConfiguration(baseline)).toThrow(
      /must include a reason/,
    );
  });

  it("rejects diagnostics and deferrals for packages outside the rollout list", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration({
        ...validBaseline(),
        diagnostics: [
          {
            packageName: "@croco/events-core",
            file: "packages/events-core/src/index.ts",
            line: 1,
            column: 1,
            code: "TS4111",
            message: "not in rollout",
          },
        ],
      }),
    ).toThrow(/unknown rollout package/);

    expect(() =>
      validateStrictContractBaselineConfiguration({
        ...validBaseline(),
        deferrals: [
          {
            packageName: "@croco/events-core",
            reason: "Not in scope.",
            owner: "@croco/core",
          },
        ],
      }),
    ).toThrow(/unknown rollout package/);
  });

  it("validates listed package strict tsconfig files", () => {
    withTempRoot((rootDir) => {
      writeStrictTsconfig(rootDir, protocolsRestPackage, {
        exactOptionalPropertyTypes: true,
        noPropertyAccessFromIndexSignature: true,
        noUncheckedIndexedAccess: true,
      });

      expect(() =>
        validateStrictContractPackageConfigurations(rootDir, [protocolsRestPackage]),
      ).not.toThrow();
    });
  });

  it("fails when a listed package loses its strict config file", () => {
    withTempRoot((rootDir) => {
      expect(() =>
        validateStrictContractPackageConfigurations(rootDir, [protocolsRestPackage]),
      ).toThrow(/Strict tsconfig missing/);
    });
  });

  it("fails when a listed package disables a required strict option", () => {
    withTempRoot((rootDir) => {
      writeStrictTsconfig(rootDir, protocolsRestPackage, {
        exactOptionalPropertyTypes: true,
        noPropertyAccessFromIndexSignature: false,
        noUncheckedIndexedAccess: true,
      });

      expect(() =>
        validateStrictContractPackageConfigurations(rootDir, [protocolsRestPackage]),
      ).toThrow(/compilerOptions\.noPropertyAccessFromIndexSignature/);
    });
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
    packages: [
      "@croco/protocols-core",
      "@croco/protocols-rest",
      "@croco/openapi-spec",
      "@croco/rpc-codegen",
      "@croco/transports-http",
    ],
    deferrals: [],
    diagnostics: [],
  };
}

function withTempRoot(run: (rootDir: string) => void): void {
  const rootDir = mkdtempSync(join(tmpdir(), "strict-contract-typecheck-"));
  try {
    run(rootDir);
  } finally {
    rmSync(rootDir, { force: true, recursive: true });
  }
}

function writeStrictTsconfig(
  rootDir: string,
  pkg: StrictContractPackage,
  compilerOptions: Record<string, unknown>,
): void {
  const tsconfigPath = join(rootDir, pkg.tsconfig);
  mkdirSync(dirname(tsconfigPath), { recursive: true });
  writeFileSync(tsconfigPath, `${JSON.stringify({ compilerOptions }, null, 2)}\n`);
}
