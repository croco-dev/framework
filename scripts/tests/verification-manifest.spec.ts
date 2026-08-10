import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
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
import { effectivePublishManifest, findPackageJsonFiles } from "../package-manifest-contracts.mjs";
import {
  assertGeneratedSmokeCaseDependencyMapping,
  assertGeneratedSmokeDependencyMapping,
  selectGeneratedSmokeCasesForChangedFiles,
} from "../create-croco-app-generated-smoke-dependencies.mts";
import { getGeneratedSmokeDependencyCaseInputs } from "../create-croco-app-generated-smoke.mts";
import { generate } from "../../packages/create-croco-app/src/generator.ts";
import {
  normalizeNonInteractiveOptions,
  parseCliOptions,
} from "../../packages/create-croco-app/src/options.ts";
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

function parseGeneratedSmokeRawOptions(args: readonly string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    if (arg.startsWith("--no-")) {
      options[toCamelCase(arg.slice("--no-".length))] = false;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      options[toCamelCase(arg.slice(2))] = true;
      continue;
    }
    options[toCamelCase(arg.slice(2))] = value;
    index += 1;
  }
  return options;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
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
  "ci-performance-budget",
  "architecture-policy-runtime",
  "architecture-policy",
  "architecture-circular-allowlist",
  "dependency-boundaries",
  "security-allowlists",
  "generated-secret-placeholders",
  "compiler-baseline",
  "decorator-signature-spike",
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
  "cli-source-e2e",
  "cli-packed-e2e",
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
      "engagement-packed-consumer",
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

  it("runs the packed engagement consumer only for engagement package changes", () => {
    const selected = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: ["packages/engagement-core/src/libs/MessageContracts.ts"],
      head: "HEAD",
    }).find(({ id }) => id === "engagement-packed-consumer");
    expect(selected).toMatchObject({
      applicable: true,
      command: ["pnpm", "--filter", "@croco/engagement-core", "test:packed"],
    });

    const unrelated = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: ["packages/retry-core/src/libs/Retry.ts"],
      head: "HEAD",
    }).find(({ id }) => id === "engagement-packed-consumer");
    expect(unrelated?.applicable).toBe(false);
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

  it("keeps affected task evidence while selecting scoped package accountability checks", () => {
    const manifest = createVerificationManifest("spine", {
      base: "origin/trunk",
      changedFiles: ["packages/customer-health-core/src/libs/CustomerHealthScore.ts"],
      head: "HEAD",
    });
    const byId = new Map(manifest.map((command) => [command.id, command]));

    expect(byId.get("build")?.command).toContain("--filter=...[origin/trunk]");
    expect(byId.get("typecheck")?.command).toContain("--filter=...[origin/trunk]");
    expect(byId.get("test")?.command).toContain("--filter=...[origin/trunk]");
    expect(byId.get("test")?.command).toContain("--force");
    expect(manifest.findIndex(({ id }) => id === "build")).toBeLessThan(
      manifest.findIndex(({ id }) => id === "typecheck"),
    );
    expect(manifest.findIndex(({ id }) => id === "typecheck")).toBeLessThan(
      manifest.findIndex(({ id }) => id === "test"),
    );
    expect(byId.get("package-entrypoints-smoke")?.command).toContain("--build-missing");
    for (const id of [
      "alpha-release-smoke",
      "cli-source-e2e",
      "cli-packed-e2e",
      "core-coverage",
      "package-bins-smoke",
      "package-entrypoints-smoke",
      "quick-start-lambda-smoke",
    ]) {
      expect(byId.get(id)?.applicable, id).toBe(false);
    }
    for (const id of ["production-ready", "spine-promotion"]) {
      expect(byId.get(id)?.applicable, id).toBe(true);
      expect(byId.get(id)?.selectionReason, id).toContain(
        "packages/customer-health-core/src/libs/CustomerHealthScore.ts",
      );
    }
    expect(byId.get("generated-app-smoke")?.applicable).toBe(false);
    expect(byId.get("spine-promotion")?.command).toContain("customer-health-core");
  });

  it("selects package accountability checks for scoped certified, spine, and catalog changes", () => {
    for (const path of [
      "packages/telemetry-api/src/index.ts",
      "packages/retry-core/src/index.ts",
      "docs/package-catalog.json",
    ]) {
      const byId = new Map(
        createVerificationManifest("spine", {
          base: "origin/trunk",
          changedFiles: [path],
          head: "HEAD",
        }).map((command) => [command.id, command]),
      );

      for (const id of ["production-ready", "spine-promotion"]) {
        expect(byId.get(id)?.applicable, `${id}: ${path}`).toBe(true);
        expect(byId.get(id)?.selectionReason, `${id}: ${path}`).toContain(path);
      }
      const isCatalog = path === "docs/package-catalog.json";
      expect(byId.get("build")?.command.includes("--filter=...[origin/trunk]"), path).toBe(
        !isCatalog,
      );
      expect(byId.get("typecheck")?.command.includes("--filter=...[origin/trunk]"), path).toBe(
        !isCatalog,
      );
      expect(byId.get("test")?.command.includes("--filter=...[origin/trunk]"), path).toBe(
        !isCatalog,
      );
      const affectedGeneratedSmokeCases = selectGeneratedSmokeCasesForChangedFiles([path]);
      expect(byId.get("generated-app-smoke")?.applicable, path).toBe(
        isCatalog || affectedGeneratedSmokeCases.length > 0,
      );
      if (isCatalog) {
        expect(byId.get("generated-app-smoke")?.command, path).toContain("--tier");
        expect(byId.get("generated-app-smoke")?.command, path).toContain("spine-blocking");
      }
      if (!isCatalog) {
        expect(byId.get("spine-promotion")?.command, path).toContain(path.split("/")[1]);
      }
    }
  });

  it("keeps catalog accountability unscoped when package files change in the same range", () => {
    const byId = new Map(
      createVerificationManifest("spine", {
        base: "origin/trunk",
        changedFiles: ["docs/package-catalog.json", "packages/retry-core/src/index.ts"],
        head: "HEAD",
      }).map((command) => [command.id, command]),
    );

    expect(byId.get("build")?.command.some((argument) => argument.startsWith("--filter="))).toBe(
      false,
    );
    expect(byId.get("generated-app-smoke")?.applicable).toBe(true);
    expect(byId.get("spine-promotion")?.command).not.toContain("--package");
  });

  it("keeps targeted scaffold PR smoke and full non-PR spine coverage", () => {
    const scaffoldPullRequest = createVerificationManifest("spine", {
      base: "origin/trunk",
      changedFiles: ["packages/create-croco-app/src/index.ts"],
      head: "HEAD",
    });
    const pullRequestById = new Map(scaffoldPullRequest.map((command) => [command.id, command]));
    const fullById = new Map(
      createVerificationManifest("spine").map((command) => [command.id, command]),
    );
    const journeyArtifact = (command: EvidenceCommand | undefined) =>
      command?.artifacts?.find(
        ({ path }) => path === "ci-reports/generated-apps/spine-blocking-journeys",
      );

    expect(pullRequestById.get("generated-app-smoke")?.applicable).toBe(true);
    expect(journeyArtifact(pullRequestById.get("generated-app-smoke"))?.required).toBe(true);
    expect(pullRequestById.get("cli-source-e2e")?.applicable).toBe(false);
    expect(pullRequestById.get("cli-packed-e2e")?.applicable).toBe(true);
    expect(pullRequestById.get("alpha-release-smoke")?.applicable).toBe(false);
    expect(fullById.get("generated-app-smoke")?.applicable).toBe(true);
    expect(journeyArtifact(fullById.get("generated-app-smoke"))?.required).toBe(true);
    expect(fullById.get("alpha-release-smoke")?.applicable).toBe(true);
    expect(fullById.get("production-ready")?.applicable).toBe(true);
    expect(fullById.get("spine-promotion")?.applicable).toBe(true);
  });

  it("selects generated smoke cases through template runtime dependency closure", () => {
    assertGeneratedSmokeDependencyMapping();

    for (const packagePath of [
      "packages/protocols-rest/src/index.ts",
      "packages/transports-http/src/index.ts",
      "packages/telemetry-sdk-node/src/index.ts",
    ]) {
      const selectedCases = selectGeneratedSmokeCasesForChangedFiles([packagePath]);
      const manifest = createVerificationManifest("spine", {
        base: "origin/trunk",
        changedFiles: [packagePath],
        head: "HEAD",
      });
      const generatedSmoke = manifest.find(({ id }) => id === "generated-app-smoke");

      expect(selectedCases.length, packagePath).toBeGreaterThan(0);
      expect(selectedCases.length, packagePath).toBeLessThan(18);
      expect(generatedSmoke?.applicable, packagePath).toBe(true);
      expect(generatedSmoke?.command, packagePath).toEqual([
        "node",
        "--experimental-strip-types",
        "scripts/create-croco-app-generated-smoke.mts",
        ...selectedCases,
      ]);
      expect(
        generatedSmoke?.artifacts?.find(
          ({ path }) => path === "ci-reports/generated-apps/spine-blocking-journeys",
        )?.required,
        packagePath,
      ).toBe(false);
      expect(
        generatedSmoke?.artifacts?.filter(({ path }) => path.includes("spine-blocking-matrix")),
        packagePath,
      ).toHaveLength(2);
      expect(
        generatedSmoke?.artifacts
          ?.filter(({ path }) => path.includes("spine-blocking-matrix"))
          .every(({ required }) => required),
        packagePath,
      ).toBe(true);
    }
  });

  it("does not select generated smoke for an unrelated package change", () => {
    const changedFiles = ["packages/customer-health-core/src/libs/CustomerHealthScore.ts"];
    expect(selectGeneratedSmokeCasesForChangedFiles(changedFiles)).toEqual([]);
    expect(
      createVerificationManifest("spine", {
        base: "origin/trunk",
        changedFiles,
        head: "HEAD",
      }).find(({ id }) => id === "generated-app-smoke")?.applicable,
    ).toBe(false);
  });

  it("selects the exact generated case for a dynamically injected provider dependency", () => {
    expect(selectGeneratedSmokeCasesForChangedFiles(["packages/storage-r2/src/index.ts"])).toEqual([
      "saas-cloudflare-profile",
    ]);
    expect(
      selectGeneratedSmokeCasesForChangedFiles(["packages/auth-better-auth/src/index.ts"]),
    ).toEqual(["goal-saas-api", "saas-golden-path", "ai-saas-golden-path"]);
  });

  it("selects dynamically injected tenant and UI dependencies", () => {
    expect(
      selectGeneratedSmokeCasesForChangedFiles(["packages/tx-drizzle/src/index.ts"]),
    ).toContain("saas-golden-path");
    expect(selectGeneratedSmokeCasesForChangedFiles(["packages/ui-astryx/src/index.ts"])).toEqual([
      "graphql-vite-spa-astryx",
    ]);
    expect(
      selectGeneratedSmokeCasesForChangedFiles(["packages/dataloader-core/src/index.ts"]),
    ).toEqual([]);
  });

  it("materializes every generated smoke case independently of dependency selection", async () => {
    const generatedRoot = mkdtempSync(join(tmpdir(), "croco-smoke-dependency-contract-"));
    try {
      for (const smokeCase of getGeneratedSmokeDependencyCaseInputs()) {
        const projectDir = join(generatedRoot, smokeCase.name);
        const cliOptions = parseCliOptions(
          projectDir,
          parseGeneratedSmokeRawOptions(smokeCase.args),
        );
        await generate(projectDir, normalizeNonInteractiveOptions(cliOptions));
        assertGeneratedSmokeCaseDependencyMapping(smokeCase.name, projectDir);
      }
    } finally {
      rmSync(generatedRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it("does not require package build artifacts for repository-only CI maintenance", () => {
    const maintenance = createVerificationManifest("publish", {
      base: "origin/trunk",
      changedFiles: [
        ".github/workflows/ci.yml",
        "scripts/ci-performance-budget.mts",
        "scripts/tests/ci-workflow.spec.ts",
        "scripts/verification-manifest.mts",
      ],
      head: "HEAD",
    });
    const byId = new Map(maintenance.map((command) => [command.id, command]));

    for (const id of [
      "cli-source-e2e",
      "cli-packed-e2e",
      "first-success",
      "generated-app-smoke",
      "package-bins-smoke",
      "package-entrypoints-smoke",
      "production-ready",
      "quick-start-lambda-smoke",
      "spine-promotion",
    ]) {
      expect(byId.get(id)?.applicable, id).toBe(false);
    }
    expect(byId.get("production-ready")?.selectionReason).toBe(
      "Skipped because no package graph or package catalog input changed.",
    );
    expect(byId.get("spine-promotion")?.selectionReason).toBe(
      "Skipped because no package graph or package catalog input changed.",
    );
    expect(byId.get("build")?.command).toContain("--filter=...[origin/trunk]");
    expect(byId.get("typecheck")?.command).toContain("--filter=...[origin/trunk]");
    expect(byId.get("test")?.command).toContain("--filter=...[origin/trunk]");
    expect(byId.get("release-gate-tests")?.applicable).toBe(true);
  });

  it("distinguishes source and packed CLI integration selectors", () => {
    const cliChange = createVerificationManifest("spine", {
      base: "origin/trunk",
      changedFiles: ["packages/cli/src/index.ts"],
      head: "HEAD",
    });
    const generatorChange = createVerificationManifest("spine", {
      base: "origin/trunk",
      changedFiles: ["packages/create-croco-app/src/index.ts"],
      head: "HEAD",
    });

    expect(cliChange.find(({ id }) => id === "cli-source-e2e")).toMatchObject({
      applicable: true,
      command: expect.arrayContaining(["src/tests/integration/e2e.spec.ts"]),
      label: "CLI source integration tests",
    });
    expect(cliChange.find(({ id }) => id === "cli-packed-e2e")).toMatchObject({
      applicable: true,
      command: expect.arrayContaining(["src/tests/integration/CliCommandIntegration.spec.ts"]),
      label: "Packed installed CLI integration tests",
    });
    expect(generatorChange.find(({ id }) => id === "cli-source-e2e")?.applicable).toBe(false);
    expect(generatorChange.find(({ id }) => id === "cli-packed-e2e")).toMatchObject({
      applicable: true,
      command: expect.arrayContaining(["src/tests/integration/CliCommandIntegration.spec.ts"]),
      label: "Packed installed CLI integration tests",
    });
  });

  it("uses full evidence only for root accountability changes", () => {
    for (const path of [
      "pnpm-lock.yaml",
      "packages/create-croco-app/src/index.ts",
      "packages/cli/src/index.ts",
    ]) {
      const manifest = createVerificationManifest("publish", {
        base: "origin/trunk",
        changedFiles: [path],
        head: "HEAD",
      });
      const build = manifest.find(({ id }) => id === "build");

      expect(build?.command.includes("--filter=...[origin/trunk]"), path).toBe(
        path !== "pnpm-lock.yaml",
      );
      expect(
        manifest.findIndex(({ id }) => id === "build"),
        path,
      ).toBeLessThan(manifest.findIndex(({ id }) => id === "generated-app-smoke"));
    }
  });

  it("builds every package binary before a scoped package-accountability binary smoke", () => {
    const binPackages = findPackageJsonFiles(resolve(ROOT_DIR, "packages"))
      .map((packagePath) => {
        const sourcePkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
          readonly name?: string;
          readonly private?: boolean;
          readonly publishConfig?: Record<string, unknown>;
        };
        const publishManifest = effectivePublishManifest(sourcePkg) as {
          readonly bin?: unknown;
        };
        return {
          bin: publishManifest.bin,
          name: sourcePkg.name,
          packagePath,
          private: sourcePkg.private,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          readonly bin: unknown;
          readonly name: string;
          readonly packagePath: string;
          readonly private?: boolean;
        } => entry.private !== true && entry.bin !== undefined && typeof entry.name === "string",
      );
    const expectedBinFilters = binPackages.map(({ name }) => `--filter=${name}`).sort();
    for (const { packagePath } of binPackages) {
      const manifest = createVerificationManifest("publish", {
        base: "origin/trunk",
        changedFiles: [`${relative(ROOT_DIR, dirname(packagePath))}/src/index.ts`],
        head: "HEAD",
      });
      const packageBuildFilters = [
        ...new Set(
          manifest
            .find(({ id }) => id === "build")
            ?.command.filter(
              (argument) =>
                argument.startsWith("--filter=") &&
                argument !== "--filter=...[origin/trunk]" &&
                argument !== "--filter=!@croco/docs",
            ),
        ),
      ].sort();

      expect(packageBuildFilters).toEqual(expectedBinFilters);
      expect(manifest.find(({ id }) => id === "package-bins-smoke")?.applicable).toBe(true);
    }
  });

  it("keeps the release-gate inventory complete, sorted, and executable from one root alias", () => {
    const command = createVerificationManifest("publish").find(
      ({ id }) => id === "release-gate-tests",
    );
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(RELEASE_GATE_TEST_PATHS).toHaveLength(43);
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
    expect(command?.applicable).toBe(true);
    expect(command?.command).toContain("scripts/tests/turbo-task-contract.spec.ts");
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
      "scripts/tests/ci-performance-budget.spec.ts",
      "scripts/tests/release-workflow.spec.ts",
      "scripts/tests/turbo-task-contract.spec.ts",
      "scripts/tests/verification-policy.spec.ts",
    ]);
  });

  it("builds verification runtime prerequisites through the mutation guard", () => {
    const command = createVerificationManifest("repo").find(
      ({ id }) => id === "architecture-policy-runtime",
    );

    expect(command?.command).toEqual([
      "node",
      "--experimental-strip-types",
      "scripts/tracked-file-mutation-guard.mts",
      "--recovery",
      "Fix the verification runtime build prerequisites",
      "--",
      "pnpm",
      "--filter",
      "@croco/architecture-policy...",
      "--filter",
      "@croco/tenant-core...",
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
