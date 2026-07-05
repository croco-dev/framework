import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  collectStrictContractDiagnostics,
  compareStrictContractDiagnostics,
  findRcRejectedDiagnostics,
  normalizeStrictContractDiagnostics,
  parseStrictContractCliOptions,
  resolveStrictContractSpinePackages,
  validateStrictContractBaselineConfiguration,
  validateStrictContractPackageConfigurations,
  type StrictContractBaseline,
  type StrictContractDebt,
  type StrictContractPackage,
} from "../strict-contract-typecheck.mts";

const protocolsCorePackage: StrictContractPackage = {
  name: "@croco/protocols-core",
  slug: "protocols-core",
  path: "packages/protocols-core",
  tsconfig: "packages/protocols-core/tsconfig.contract-strict.json",
};

const protocolsRestPackage: StrictContractPackage = {
  name: "@croco/protocols-rest",
  slug: "protocols-rest",
  path: "packages/protocols-rest",
  tsconfig: "packages/protocols-rest/tsconfig.contract-strict.json",
};

const eventsCorePackage: StrictContractPackage = {
  name: "@croco/events-core",
  slug: "events-core",
  path: "packages/events-core",
  tsconfig: "packages/events-core/tsconfig.contract-strict.json",
};

const testSpinePackages = [protocolsCorePackage, protocolsRestPackage, eventsCorePackage] as const;

const acceptedDiagnostic = {
  packageName: "@croco/protocols-rest",
  file: "packages/protocols-rest/src/libs/types.ts",
  line: 10,
  column: 3,
  code: "TS2375",
  message: "accepted strict diagnostic",
};

describe("strict-contract-typecheck.mts", () => {
  it("normalizes diagnostics for the rollout package and filters dependency diagnostics", () => {
    const diagnostics = normalizeStrictContractDiagnostics(
      "/repo",
      protocolsCorePackage,
      [
        "packages/problems-core/src/libs/Problem.ts(56,5): error TS2412: dependency strict diagnostic",
        "packages/protocols-core/src/libs/ContractGraph.ts(183,3): error TS6059: File '/repo/packages/problems-core/src/index.ts' is not under 'rootDir' '/repo/packages/protocols-core/src'. 'rootDir' is expected to contain all source files.",
        "",
      ].join("\n"),
    );

    expect(diagnostics).toEqual([
      {
        packageName: "@croco/protocols-core",
        file: "packages/protocols-core/src/libs/ContractGraph.ts",
        line: 183,
        column: 3,
        code: "TS6059",
        message:
          "File 'packages/problems-core/src/index.ts' is not under 'rootDir' 'packages/protocols-core/src'. 'rootDir' is expected to contain all source files.",
      },
    ]);
  });

  it("reports added, removed, and unchanged diagnostics relative to the baseline", () => {
    const removed = {
      packageName: "@croco/protocols-core",
      file: "packages/protocols-core/src/libs/ContractGraph.ts",
      line: 183,
      column: 3,
      code: "TS2322",
      message: "baseline diagnostic",
    };
    const unchanged = {
      packageName: "@croco/protocols-rest",
      file: "packages/protocols-rest/src/libs/types.ts",
      line: 10,
      column: 3,
      code: "TS2375",
      message: "accepted strict diagnostic",
    };
    const added = {
      packageName: "@croco/protocols-core",
      file: "packages/protocols-core/src/libs/ContractGraphSnapshot.ts",
      line: 114,
      column: 11,
      code: "TS4111",
      message: "new diagnostic",
    };

    expect(compareStrictContractDiagnostics([removed, unchanged], [unchanged, added])).toEqual({
      added: [added],
      removed: [removed],
      unchanged: [unchanged],
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

  it("resolves spine package publish names from the package catalog", () => {
    withTempRoot((rootDir) => {
      writeCatalog(rootDir, ["protocols-core", "create-croco-app"]);
      writePackageManifest(rootDir, "protocols-core", "@croco/protocols-core");
      writePackageManifest(rootDir, "create-croco-app", "create-croco-app");

      expect(resolveStrictContractSpinePackages(rootDir)).toEqual([
        protocolsCorePackage,
        {
          name: "create-croco-app",
          slug: "create-croco-app",
          path: "packages/create-croco-app",
          tsconfig: "packages/create-croco-app/tsconfig.contract-strict.json",
        },
      ]);
    });
  });

  it("rejects duplicate catalog slugs or publish names", () => {
    withTempRoot((rootDir) => {
      writeCatalog(rootDir, ["protocols-core", "protocols-core"]);
      writePackageManifest(rootDir, "protocols-core", "@croco/protocols-core");

      expect(() => resolveStrictContractSpinePackages(rootDir)).toThrow(/slug is duplicated/);
    });

    withTempRoot((rootDir) => {
      writeCatalog(rootDir, ["protocols-core", "protocols-rest"]);
      writePackageManifest(rootDir, "protocols-core", "@croco/protocols-core");
      writePackageManifest(rootDir, "protocols-rest", "@croco/protocols-core");

      expect(() => resolveStrictContractSpinePackages(rootDir)).toThrow(
        /publish name is duplicated/,
      );
    });
  });

  it("accepts baseline metadata that partitions the strict spine without exemptions", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration(validBaseline(), testSpinePackages),
    ).not.toThrow();
  });

  it("accepts explicit machine-readable exemptions for unenrolled spine packages", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          packages: ["@croco/protocols-core", "@croco/protocols-rest"],
          exemptions: [
            {
              packageName: "@croco/events-core",
              reason: "Events strict enrollment is tracked as release debt.",
              owner: "@croco/events",
              targetMilestone: "1.0 RC",
            },
          ],
        },
        testSpinePackages,
      ),
    ).not.toThrow();
  });

  it("rejects stale baseline metadata before comparing diagnostics", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          strictOptions: ["exactOptionalPropertyTypes"],
        },
        testSpinePackages,
      ),
    ).toThrow(/Baseline strictOptions mismatch/);

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          packages: ["@croco/protocols-rest"],
        },
        testSpinePackages,
      ),
    ).toThrow(/Baseline packages mismatch/);
  });

  it("rejects exemptions that are incomplete, stale, or overlap enrolled packages", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          exemptions: [
            {
              packageName: "@croco/events-core",
              reason: "Missing target metadata.",
              owner: "@croco/events",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/cannot be both enrolled and exempted/);

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          packages: ["@croco/protocols-core", "@croco/protocols-rest"],
          exemptions: [
            {
              packageName: "@croco/events-core",
              reason: "Missing target metadata.",
              owner: "@croco/events",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/must include expiresOn or targetMilestone/);

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          packages: ["@croco/protocols-core", "@croco/protocols-rest"],
          exemptions: [
            {
              packageName: "@croco/not-spine",
              reason: "Not in spine.",
              owner: "@croco/core",
              targetMilestone: "1.0 RC",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/outside the 1.0 spine catalog/);
  });

  it("requires deferral metadata for every package with accepted diagnostics", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          diagnostics: [acceptedDiagnostic],
        },
        testSpinePackages,
      ),
    ).toThrow(/require deferral metadata/);

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          deferrals: [
            {
              packageName: "@croco/protocols-rest",
              reason: "Tracked as a staged package migration.",
              owner: "@croco/core",
              debt: "staged-rollout",
              targetMilestone: "1.0 RC",
            },
          ],
          diagnostics: [acceptedDiagnostic],
        },
        testSpinePackages,
      ),
    ).not.toThrow();
  });

  it("rejects deferrals without complete release debt metadata", () => {
    const baseline = {
      ...validBaseline(),
      deferrals: [
        {
          packageName: "@croco/protocols-rest",
          reason: "",
          owner: "@croco/core",
          debt: "staged-rollout" as const,
          targetMilestone: "1.0 RC",
        },
      ],
      diagnostics: [acceptedDiagnostic],
    };

    expect(() => validateStrictContractBaselineConfiguration(baseline, testSpinePackages)).toThrow(
      /must include a reason/,
    );

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...baseline,
          deferrals: [
            {
              packageName: "@croco/protocols-rest",
              reason: "Tracked as a staged package migration.",
              owner: "@croco/core",
              debt: "unknown" as StrictContractDebt,
              targetMilestone: "1.0 RC",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/must set debt/);

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...baseline,
          deferrals: [
            {
              packageName: "@croco/protocols-rest",
              reason: "Tracked as a staged package migration.",
              owner: "@croco/core",
              debt: "staged-rollout",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/must include expiresOn or targetMilestone/);
  });

  it("rejects diagnostics and deferrals for packages outside the enrolled list", () => {
    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          diagnostics: [
            {
              packageName: "@croco/not-spine",
              file: "packages/not-spine/src/index.ts",
              line: 1,
              column: 1,
              code: "TS4111",
              message: "not in rollout",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/not enrolled/);

    expect(() =>
      validateStrictContractBaselineConfiguration(
        {
          ...validBaseline(),
          deferrals: [
            {
              packageName: "@croco/events-core",
              reason: "No diagnostics.",
              owner: "@croco/core",
              debt: "staged-rollout",
              targetMilestone: "1.0 RC",
            },
          ],
        },
        testSpinePackages,
      ),
    ).toThrow(/has no matching diagnostics/);
  });

  it("classifies staged diagnostics as RC blockers", () => {
    const stagedBaseline = {
      ...validBaseline(),
      deferrals: [
        {
          packageName: "@croco/protocols-rest",
          reason: "Tracked as a staged package migration.",
          owner: "@croco/core",
          debt: "staged-rollout" as const,
          targetMilestone: "1.0 RC",
        },
      ],
      diagnostics: [acceptedDiagnostic],
    };
    const releaseDebtBaseline = {
      ...stagedBaseline,
      deferrals: [
        {
          ...stagedBaseline.deferrals[0],
          debt: "accepted-release-debt" as const,
        },
      ],
    };
    const comparison = compareStrictContractDiagnostics([acceptedDiagnostic], [acceptedDiagnostic]);

    expect(findRcRejectedDiagnostics(stagedBaseline, comparison)).toEqual([acceptedDiagnostic]);
    expect(findRcRejectedDiagnostics(releaseDebtBaseline, comparison)).toEqual([]);
  });

  it("parses RC mode from CLI flags and environment", () => {
    expect(parseStrictContractCliOptions([], {}).rc).toBe(false);
    expect(parseStrictContractCliOptions(["--rc"], {}).rc).toBe(true);
    expect(parseStrictContractCliOptions([], { CROCO_STRICT_CONTRACT_RC: "1" }).rc).toBe(true);
    expect(() => parseStrictContractCliOptions(["--unknown"], {})).toThrow(/Unknown/);
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

  it("uses --rc to reject staged unchanged diagnostics from the CLI", () => {
    withTempRoot((rootDir) => {
      writeCliFixture(rootDir, "staged-rollout");
      const binDir = writeFakePnpm(rootDir, `${diagnosticLine(acceptedDiagnostic)}\n`, 2);
      const result = runStrictContractCli(rootDir, binDir, ["--rc"], {});

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("strict-contract-typecheck: mode rc");
      expect(result.stdout).toContain(
        "strict-contract-typecheck: diagnostics added 0, removed 0, unchanged 1",
      );
      expect(result.stderr).toContain("rc mode rejected 1 staged diagnostic debt item");
    });
  });

  it("uses CROCO_STRICT_CONTRACT_RC to allow accepted release debt from the CLI", () => {
    withTempRoot((rootDir) => {
      writeCliFixture(rootDir, "accepted-release-debt");
      const binDir = writeFakePnpm(rootDir, `${diagnosticLine(acceptedDiagnostic)}\n`, 2);
      const result = runStrictContractCli(rootDir, binDir, [], { CROCO_STRICT_CONTRACT_RC: "1" });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("strict-contract-typecheck: mode rc");
      expect(result.stdout).toContain(
        "strict-contract-typecheck: accepted release debt deferrals 1 (@croco/protocols-rest)",
      );
      expect(result.stdout).toContain("strict-contract-typecheck: baseline matched");
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
    packages: ["@croco/protocols-core", "@croco/protocols-rest", "@croco/events-core"],
    exemptions: [],
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

function writeCatalog(rootDir: string, slugs: readonly string[]): void {
  const path = join(rootDir, "docs/package-catalog.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ spine: { packages: slugs } }, null, 2)}\n`);
}

function writePackageManifest(rootDir: string, slug: string, packageName: string): void {
  const path = join(rootDir, `packages/${slug}/package.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ name: packageName }, null, 2)}\n`);
}

function writeCliFixture(rootDir: string, debt: StrictContractDebt): void {
  writeCatalog(rootDir, ["protocols-rest"]);
  writePackageManifest(rootDir, "protocols-rest", "@croco/protocols-rest");
  writeStrictTsconfig(rootDir, protocolsRestPackage, {
    exactOptionalPropertyTypes: true,
    noPropertyAccessFromIndexSignature: true,
    noUncheckedIndexedAccess: true,
  });
  const baselinePath = join(rootDir, "tsconfig/contract-strict.baseline.json");
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        ...validBaseline(),
        packages: ["@croco/protocols-rest"],
        deferrals: [
          {
            packageName: "@croco/protocols-rest",
            reason: "Tracked as test debt.",
            owner: "@croco/core",
            debt,
            targetMilestone: "1.0 RC",
          },
        ],
        diagnostics: [acceptedDiagnostic],
      },
      null,
      2,
    )}\n`,
  );
}

function writeFakePnpm(rootDir: string, output: string, status: number): string {
  const binDir = join(rootDir, "bin");
  mkdirSync(binDir, { recursive: true });
  const pnpmPath = join(binDir, "pnpm");
  writeFileSync(
    pnpmPath,
    `#!/bin/sh\nprintf '%s' '${output.replaceAll("'", "'\\''")}'\nexit ${status}\n`,
  );
  chmodSync(pnpmPath, 0o755);
  return binDir;
}

function runStrictContractCli(
  rootDir: string,
  binDir: string,
  args: readonly string[],
  env: Record<string, string>,
): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      join(process.cwd(), "scripts/strict-contract-typecheck.mts"),
      ...args,
    ],
    {
      cwd: rootDir,
      encoding: "utf-8",
      env: {
        ...process.env,
        ...env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    },
  );
}

function diagnosticLine(diagnostic: typeof acceptedDiagnostic): string {
  return `${diagnostic.file}(${diagnostic.line},${diagnostic.column}): error ${diagnostic.code}: ${diagnostic.message}`;
}
