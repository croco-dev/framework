import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertVerificationManifest,
  createVerificationManifest,
  verificationImplementationPaths,
} from "../verification-manifest.mts";
import {
  RELEASE_GATE_ENTRYPOINT_PATHS,
  RELEASE_GATE_IMPLEMENTATION_PATHS,
  RELEASE_GATE_MAINTENANCE_PATHS,
  RELEASE_GATE_POLICY_INPUT_PATHS,
  RELEASE_GATE_SUPPORT_PATHS,
  RELEASE_GATE_TEST_PATHS,
  RELEASE_GATE_WORKFLOW_PATHS,
} from "../release-gate-maintenance.mts";
import type { EvidenceCommand } from "../release-spine-evidence.mts";

const ROOT_DIR = resolve(__dirname, "../..");
const SCRIPT_EXTENSIONS = [".mts", ".ts", ".mjs", ".js"] as const;

function releaseGateImportSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/(?:\bfrom\s+|\bimport\s*(?:\(\s*)?)(["'])(\.{1,2}\/[^"']+)\1/g)]
    .map((match) => match[2])
    .filter((specifier): specifier is string => specifier !== undefined);
}

function discoverReleaseGateScriptPaths(roots: readonly string[]): readonly string[] {
  const discovered = new Set<string>();
  const pending = [...roots];

  for (const path of pending) {
    if (discovered.has(path)) continue;
    discovered.add(path);

    const source = readFileSync(resolve(ROOT_DIR, path), "utf8");
    for (const specifier of releaseGateImportSpecifiers(source)) {
      const unresolved = resolve(ROOT_DIR, dirname(path), specifier);
      const candidates = extname(unresolved)
        ? [unresolved]
        : SCRIPT_EXTENSIONS.map((extension) => `${unresolved}${extension}`);
      const resolved = candidates.find((candidate) => existsSync(candidate));
      if (!resolved) continue;
      const repositoryPath = relative(ROOT_DIR, resolved).replaceAll("\\", "/");
      if (repositoryPath.startsWith("scripts/") && !discovered.has(repositoryPath)) {
        pending.push(repositoryPath);
      }
    }
  }

  return [...discovered].sort();
}

const repoIds = [
  "verification-policy",
  "verification-contract-tests",
  "changeset-required",
  "package-manifests",
  "release-version-sync",
  "docs-catalog",
  "docs-api-triggers",
  "problem-registry",
  "docs-examples",
  "release-docs",
  "ci-executables",
  "architecture-policy-runtime",
  "architecture-policy",
  "architecture-circular-allowlist",
  "dependency-boundaries",
  "security-allowlists",
  "generated-secret-placeholders",
  "compiler-baseline",
  "strict-contract-typecheck",
  "static-misuse",
  "lint",
  "format",
  "architecture-circular",
  "benchmark-thresholds",
];
const spineOnlyIds = [
  "build",
  "quick-start-lambda-smoke",
  "first-success",
  "package-entrypoints-smoke",
  "package-bins-smoke",
  "generated-app-smoke",
  "alpha-release-smoke",
  "typecheck",
  "test",
  "cli-e2e",
  "provider-certification",
  "production-ready",
  "spine-promotion",
  "core-coverage",
  "core-coverage-warning",
  "public-api",
];

describe("verification manifest", () => {
  it("discovers static, dynamic, and side-effect relative imports", () => {
    expect(
      releaseGateImportSpecifiers(`
        import value from "./static.mts";
        import("./dynamic.mts");
        import "./side-effect.mts";
      `),
    ).toEqual(["./static.mts", "./dynamic.mts", "./side-effect.mts"]);
  });

  it("composes exact ordered repo, spine, and publish profiles", () => {
    expect(createVerificationManifest("repo").map(({ id }) => id)).toEqual(repoIds);
    expect(createVerificationManifest("spine").map(({ id }) => id)).toEqual([
      ...repoIds,
      ...spineOnlyIds,
    ]);
    expect(createVerificationManifest("publish").map(({ id }) => id)).toEqual([
      ...repoIds,
      ...spineOnlyIds,
      "release-gate-tests",
      "release-metadata",
      "spine-bundle-size",
      "dependency-audit-policy",
      "provenance-config",
      "publish-dry-run",
    ]);
    expect(
      createVerificationManifest("publish").find(({ id }) => id === "spine-bundle-size")?.command,
    ).toEqual(["node", "--experimental-strip-types", "scripts/package-quality-report.mts"]);
  });

  it("runs one authoritative release-gate suite without duplicating contract tests", () => {
    const manual = createVerificationManifest("publish");
    expect(manual.find(({ id }) => id === "release-gate-tests")?.applicable).toBe(true);
    expect(manual.find(({ id }) => id === "verification-contract-tests")?.applicable).toBe(false);

    const maintenance = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: ["scripts/production-ready-check.mts"],
      head: "HEAD",
    });
    expect(maintenance.find(({ id }) => id === "release-gate-tests")?.applicable).toBe(true);
    expect(maintenance.find(({ id }) => id === "verification-contract-tests")?.applicable).toBe(
      false,
    );

    const packageCandidate = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: ["packages/retry-core/package.json"],
      head: "HEAD",
    });
    expect(packageCandidate.find(({ id }) => id === "release-gate-tests")?.applicable).toBe(false);
    expect(
      packageCandidate.find(({ id }) => id === "verification-contract-tests")?.applicable,
    ).toBe(true);

    expect(
      createVerificationManifest("repo").find(({ id }) => id === "verification-contract-tests")
        ?.applicable,
    ).toBe(true);
    expect(
      createVerificationManifest("spine").find(({ id }) => id === "verification-contract-tests")
        ?.applicable,
    ).toBe(true);
  });

  it("keeps the release-gate inventory complete, sorted, and executable from one root alias", () => {
    const command = createVerificationManifest("publish").find(
      ({ id }) => id === "release-gate-tests",
    );
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(RELEASE_GATE_TEST_PATHS).toHaveLength(41);
    expect(RELEASE_GATE_TEST_PATHS).toEqual([...RELEASE_GATE_TEST_PATHS].sort());
    expect(RELEASE_GATE_ENTRYPOINT_PATHS).toEqual([...RELEASE_GATE_ENTRYPOINT_PATHS].sort());
    expect(RELEASE_GATE_SUPPORT_PATHS).toEqual([...RELEASE_GATE_SUPPORT_PATHS].sort());
    expect(RELEASE_GATE_POLICY_INPUT_PATHS).toEqual([...RELEASE_GATE_POLICY_INPUT_PATHS].sort());
    expect(RELEASE_GATE_WORKFLOW_PATHS).toEqual([...RELEASE_GATE_WORKFLOW_PATHS].sort());
    expect(RELEASE_GATE_ENTRYPOINT_PATHS).toEqual(verificationImplementationPaths());
    expect(new Set(RELEASE_GATE_MAINTENANCE_PATHS).size).toBe(
      RELEASE_GATE_MAINTENANCE_PATHS.length,
    );
    expect(RELEASE_GATE_MAINTENANCE_PATHS).toContain("scripts/release-gate-maintenance.mts");
    expect(command?.command).toEqual([
      "pnpm",
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      ...RELEASE_GATE_TEST_PATHS,
      "--config",
      "vitest.config.ts",
    ]);
    expect(packageJson.scripts?.["test:release-gates"]).toBe(
      "node --experimental-strip-types scripts/verification-command.mts --id release-gate-tests",
    );
    for (const path of RELEASE_GATE_MAINTENANCE_PATHS) {
      expect(existsSync(resolve(ROOT_DIR, path)), path).toBe(true);
    }
    for (const workflowPath of RELEASE_GATE_WORKFLOW_PATHS) {
      const workflowContractPath = `scripts/tests/${basename(workflowPath, ".yml")}-workflow.spec.ts`;
      expect(RELEASE_GATE_TEST_PATHS, workflowContractPath).toContain(workflowContractPath);
    }

    const discoveredScriptPaths = discoverReleaseGateScriptPaths([
      ...RELEASE_GATE_ENTRYPOINT_PATHS,
      ...RELEASE_GATE_TEST_PATHS,
      "scripts/release-gate-maintenance.mts",
    ]);
    expect(RELEASE_GATE_MAINTENANCE_PATHS).toEqual(expect.arrayContaining(discoveredScriptPaths));
    expect(RELEASE_GATE_IMPLEMENTATION_PATHS).toEqual(
      expect.arrayContaining(discoveredScriptPaths.filter((path) => !path.includes("/tests/"))),
    );

    const matchingImplementationSpecs = discoveredScriptPaths
      .filter((path) => /^scripts\/[^/]+\.(?:mts|mjs|ts)$/.test(path))
      .map(
        (implementationPath) =>
          `scripts/tests/${basename(implementationPath).replace(/\.(?:mts|mjs|ts)$/, ".spec.ts")}`,
      )
      .filter((testPath) => existsSync(testPath));
    expect(RELEASE_GATE_TEST_PATHS).toEqual(
      expect.arrayContaining([...new Set(matchingImplementationSpecs)]),
    );
  });

  it("runs publish package gates only for their relevant changed inputs", () => {
    const maintenance = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: [
        ".changeset/README.md",
        "packages/retry-core/tests/RetryTemplate.spec.ts",
        "scripts/verification-manifest.mts",
      ],
      head: "HEAD",
    });
    expect(maintenance.find(({ id }) => id === "release-metadata")?.applicable).toBe(false);
    expect(maintenance.find(({ id }) => id === "spine-bundle-size")?.applicable).toBe(false);

    for (const path of [
      ".changeset/config.json",
      "ci-reports/bundle-size/baseline.json",
      "docs/package-catalog.json",
    ]) {
      const directInput = createVerificationManifest("publish", {
        base: "origin/trunk",
        changedFiles: [path],
        head: "HEAD",
      });
      expect(directInput.find(({ id }) => id === "release-gate-tests")?.applicable).toBe(true);
      expect(directInput.find(({ id }) => id === "spine-bundle-size")?.applicable).toBe(true);
    }

    const verifierChanges = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: ["scripts/release-metadata-check.mts", "scripts/package-quality-report.mts"],
      head: "HEAD",
    });
    expect(verifierChanges.find(({ id }) => id === "release-metadata")?.applicable).toBe(true);
    expect(verifierChanges.find(({ id }) => id === "spine-bundle-size")?.applicable).toBe(true);

    const packageChange = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: [".changeset/example.md", "packages/retry-core/src/index.ts"],
      head: "HEAD",
    });
    expect(packageChange.find(({ id }) => id === "release-metadata")?.applicable).toBe(true);
    expect(packageChange.find(({ id }) => id === "spine-bundle-size")?.applicable).toBe(true);
    expect(packageChange.find(({ id }) => id === "release-metadata")?.command).not.toContain(
      "--allow-pending-changesets",
    );

    const pullRequestPackageChange = createVerificationManifest("publish", {
      allowPendingReleaseMetadata: true,
      base: "origin/trunk",
      changedFiles: [".changeset/example.md"],
      head: "HEAD",
    });
    expect(pullRequestPackageChange.find(({ id }) => id === "release-metadata")?.command).toContain(
      "--allow-pending-changesets",
    );
  });

  it("makes the changeset gate contextual", () => {
    expect(
      createVerificationManifest("repo").find(({ id }) => id === "changeset-required")?.applicable,
    ).toBe(false);
    const contextual = createVerificationManifest("repo", {
      base: "origin/trunk",
      head: "HEAD",
    }).find(({ id }) => id === "changeset-required");
    expect(contextual?.applicable).toBe(true);
    expect(contextual?.command).toContain("origin/trunk");
  });

  it("runs root workflow and manifest contract tests inside every profile", () => {
    const command = createVerificationManifest("repo").find(
      ({ id }) => id === "verification-contract-tests",
    );

    expect(command?.command).toEqual([
      "pnpm",
      "exec",
      "vitest",
      "run",
      "scripts/tests/verification-command.spec.ts",
      "scripts/tests/verification-change-classifier.spec.ts",
      "scripts/tests/verification-manifest.spec.ts",
      "scripts/tests/release-spine-evidence.spec.ts",
      "scripts/tests/ci-workflow.spec.ts",
      "scripts/tests/release-workflow.spec.ts",
      "scripts/tests/verification-policy.spec.ts",
    ]);
  });

  it("builds the architecture policy runtime prerequisite through the mutation guard", () => {
    const command = createVerificationManifest("repo").find(
      ({ id }) => id === "architecture-policy-runtime",
    );

    expect(command?.command).toEqual([
      "node",
      "--experimental-strip-types",
      "scripts/tracked-file-mutation-guard.mts",
      "--recovery",
      "Fix the @croco/problems-core build prerequisite",
      "--",
      "pnpm",
      "--filter",
      "@croco/problems-core",
      "build",
    ]);
  });

  it("rejects duplicate IDs and composite root aliases", () => {
    const command = createVerificationManifest("repo").find(
      ({ id }) => id === "package-manifests",
    ) as EvidenceCommand;
    expect(() => assertVerificationManifest([command, command])).toThrow(
      "Duplicate verification command ID",
    );
    expect(() =>
      assertVerificationManifest([{ ...command, id: "wrapper", command: ["pnpm", "check"] }]),
    ).toThrow("Composite root alias");
  });

  it("routes compatibility aliases through authoritative profiles", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.check).toBe("pnpm verify:repo");
    expect(packageJson.scripts?.["audit:read-only"]).toBe("pnpm verify:repo");
    expect(packageJson.scripts?.["verification-policy:check"]).toContain(
      "scripts/verification-command.mts --id verification-policy",
    );
  });

  it("guards every mutation-prone repository command at its manifest definition", () => {
    const guardedIds = new Set([
      "verification-policy",
      "changeset-required",
      "package-manifests",
      "docs-catalog",
      "docs-api-triggers",
      "problem-registry",
      "docs-examples",
      "release-docs",
      "ci-executables",
      "architecture-policy-runtime",
      "architecture-policy",
      "architecture-circular-allowlist",
      "dependency-boundaries",
      "security-allowlists",
      "generated-secret-placeholders",
      "compiler-baseline",
      "strict-contract-typecheck",
      "static-misuse",
      "architecture-circular",
      "benchmark-thresholds",
    ]);

    for (const command of createVerificationManifest("repo")) {
      if (!guardedIds.has(command.id)) continue;
      expect(command.command).toContain("scripts/tracked-file-mutation-guard.mts");
      expect(command.command).toContain("--recovery");
      expect(command.command).toContain("--");
    }
  });
});
