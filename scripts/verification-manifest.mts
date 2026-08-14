import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  selectGeneratedSmokeCasesForChangedFiles,
  selectGeneratedTestPathsForSmokeCases,
} from "./create-croco-app-generated-smoke-dependencies.mts";
import { GENERATED_SMOKE_MATRIX_CASES } from "./create-croco-app-generated-smoke-matrix.mts";
import {
  isReleaseGateMaintenancePath,
  RELEASE_GATE_TEST_PATHS,
} from "./release-gate-maintenance.mts";
import { readTestInventory } from "./test-inventory.mts";
import { VerificationProblem } from "./verification-problem.mts";
import type { EvidenceCommand } from "./release-spine-evidence.mts";
import type { TestLane } from "./test-inventory.mts";

export type VerificationProfile = "repo" | "spine" | "publish";

export type VerificationContext = {
  readonly allowPendingReleaseMetadata?: boolean;
  readonly base?: string;
  readonly changedFiles?: readonly string[];
  readonly head?: string;
};

const minutes = (value: number): number => value * 60 * 1000;
const nodeScript = (script: string, ...args: string[]): readonly string[] => [
  "node",
  "--experimental-strip-types",
  script,
  ...args,
];
const guarded = (recovery: string, command: readonly string[]): readonly string[] =>
  nodeScript("scripts/tracked-file-mutation-guard.mts", "--recovery", recovery, "--", ...command);
const guardedNodeScript = (
  recovery: string,
  script: string,
  ...args: string[]
): readonly string[] => guarded(recovery, nodeScript(script, ...args));

const CORE_COVERAGE_PACKAGES = [
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
] as const;

const CORE_COVERAGE_PACKAGE_DIRECTORIES = CORE_COVERAGE_PACKAGES.map((packageName) =>
  packageName.startsWith("@croco/") ? packageName.slice("@croco/".length) : packageName,
);

const PACKAGE_BIN_BUILD_FILTERS = [
  "@croco/cli",
  "create-croco-app",
  "@croco/openapi-spec",
  "@croco/migration-runner",
  "@croco/rpc-codegen",
] as const;

export const PUBLISH_REQUIRED_GENERATED_SMOKE_CASES = [
  ...GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "spine-blocking").map(
    ({ name }) => name,
  ),
  "admin-console-starter",
  "ai-saas-golden-path",
] as const;

function isApplicableToChangedFiles(
  context: VerificationContext,
  predicate: (path: string) => boolean,
): boolean {
  if (!context.base || !context.head || !context.changedFiles) return true;
  return context.changedFiles.some((path) => path === "test-inventory.json" || predicate(path));
}

function isChangeScopedVerification(context: VerificationContext): boolean {
  return Boolean(context.base && context.head && context.changedFiles);
}

function affectsScaffold(path: string): boolean {
  return (
    /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.nvmrc)$/.test(path) ||
    path.startsWith("packages/create-croco-app/") ||
    /^scripts\/(?:alpha-release-smoke|create-croco-app-[^/]+|first-success-verify|quick-start-lambda-smoke)\.mts$/.test(
      path,
    )
  );
}

function affectsPackageEntrypoints(path: string): boolean {
  return (
    /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.nvmrc)$/.test(path) ||
    /^packages\/(?!create-croco-app\/)[^/]+\/(?:package\.json|src\/index\.ts)$/.test(path) ||
    path === "scripts/package-entrypoint-smoke.mts"
  );
}

function affectsPackageBins(path: string): boolean {
  return (
    /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.nvmrc)$/.test(path) ||
    /^packages\/(?:cli|create-croco-app|migration-runner|openapi-spec|rpc-codegen)\/(?:package\.json|src\/)/.test(
      path,
    ) ||
    path === "scripts/package-bin-smoke.mts"
  );
}

function affectsCreateCrocoApp(path: string): boolean {
  return path.startsWith("packages/create-croco-app/");
}

function affectsPackageGraph(path: string): boolean {
  return (
    /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.nvmrc)$/.test(path) ||
    /^(?:apps|examples|packages)\//.test(path) ||
    path === "docs/package-catalog.json"
  );
}

function packageAccountabilitySelection(context: VerificationContext): {
  readonly applicable: boolean;
  readonly fullEvidence: boolean;
  readonly packages: readonly string[];
  readonly reason: string;
} {
  if (!isChangeScopedVerification(context) || !context.changedFiles) {
    return {
      applicable: true,
      fullEvidence: true,
      packages: [],
      reason: "Selected because this is a full verification run.",
    };
  }

  const relevantFiles = context.changedFiles.filter(affectsPackageGraph);
  if (relevantFiles.length > 0) {
    const packages = [
      ...new Set(
        relevantFiles.flatMap((path) => {
          const match = /^packages\/([^/]+)\//.exec(path);
          return match?.[1] ? [match[1]] : [];
        }),
      ),
    ].sort();
    return {
      applicable: true,
      fullEvidence: relevantFiles.some((path) => !/^(?:apps|examples|packages)\//.test(path)),
      packages,
      reason: `Selected because package accountability inputs changed: ${relevantFiles.join(", ")}.`,
    };
  }

  return {
    applicable: false,
    fullEvidence: false,
    packages: [],
    reason: "Skipped because no package graph or package catalog input changed.",
  };
}

function affectsCoreCoverage(path: string): boolean {
  return CORE_COVERAGE_PACKAGE_DIRECTORIES.some((directory) =>
    path.startsWith(`packages/${directory}/`),
  );
}

function affectedTurboArguments(context: VerificationContext): readonly string[] {
  // Docs is verified by its dedicated gates instead of the affected package build/typecheck tasks.
  return isChangeScopedVerification(context) && context.base
    ? [`--filter=...[${context.base}]`, "--filter=!@croco/docs"]
    : [];
}

const TEST_INVENTORY = readTestInventory().inventory;

type WorkspacePackage = {
  readonly dependencies: ReadonlySet<string>;
  readonly directory: string;
  readonly name: string;
};

function readWorkspacePackages(): readonly WorkspacePackage[] {
  const root = resolve(import.meta.dirname, "..");
  return ["apps", "examples", "packages"]
    .flatMap((workspaceRoot) => {
      const absoluteRoot = resolve(root, workspaceRoot);
      if (!existsSync(absoluteRoot)) return [];
      return readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
        if (!entry.isDirectory()) return [];
        const directory = `${workspaceRoot}/${entry.name}`;
        const manifestPath = resolve(root, directory, "package.json");
        if (!existsSync(manifestPath)) return [];
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          readonly name?: string;
          readonly dependencies?: Readonly<Record<string, string>>;
          readonly devDependencies?: Readonly<Record<string, string>>;
          readonly optionalDependencies?: Readonly<Record<string, string>>;
          readonly peerDependencies?: Readonly<Record<string, string>>;
        };
        if (!manifest.name) return [];
        return [
          {
            dependencies: new Set([
              ...Object.keys(manifest.dependencies ?? {}),
              ...Object.keys(manifest.devDependencies ?? {}),
              ...Object.keys(manifest.optionalDependencies ?? {}),
              ...Object.keys(manifest.peerDependencies ?? {}),
            ]),
            directory,
            name: manifest.name,
          },
        ];
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

const WORKSPACE_PACKAGES = readWorkspacePackages();
const WORKSPACE_PACKAGE_BY_DIRECTORY = new Map(
  WORKSPACE_PACKAGES.map((workspacePackage) => [workspacePackage.directory, workspacePackage]),
);

function transitivelyAffectedPackages(changedPackages: ReadonlySet<string>): ReadonlySet<string> {
  const affected = new Set(changedPackages);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const workspacePackage of WORKSPACE_PACKAGES) {
      // Docs has dedicated verification commands and is intentionally outside package test propagation.
      if (workspacePackage.name === "@croco/docs" || affected.has(workspacePackage.name)) continue;
      if ([...workspacePackage.dependencies].some((dependency) => affected.has(dependency))) {
        affected.add(workspacePackage.name);
        expanded = true;
      }
    }
  }
  return affected;
}

function inventoryEntryWorkspace(path: string): string | undefined {
  const match = /^(packages|apps|examples)\/([^/]+)\//.exec(path);
  if (match?.[1] && match[2]) return `${match[1]}/${match[2]}/`;
  if (path.startsWith("scripts/tests/")) return "scripts/";
  if (path.startsWith("tests/")) return "tests/";
  return undefined;
}

function laneSelection(
  context: VerificationContext,
  profile: VerificationProfile,
  lane: TestLane,
): { readonly applicable: boolean; readonly owners: readonly string[]; readonly full: boolean } {
  if (!isChangeScopedVerification(context) || profile === "publish") {
    return { applicable: true, owners: [], full: true };
  }
  const changedFiles = context.changedFiles ?? [];
  const full = changedFiles.some(
    (path) =>
      path === "test-inventory.json" ||
      /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|vitest(?:\.[^/]+)?\.ts)$/.test(
        path,
      ),
  );
  if (full) return { applicable: true, owners: [], full: true };
  const directlyChangedPackages = new Set(
    changedFiles.flatMap((path) => {
      const workspace = inventoryEntryWorkspace(path);
      if (!workspace || workspace === "scripts/" || workspace === "tests/") return [];
      const workspacePackage = WORKSPACE_PACKAGE_BY_DIRECTORY.get(workspace.slice(0, -1));
      return workspacePackage ? [workspacePackage.name] : [];
    }),
  );
  const affectedPackages = transitivelyAffectedPackages(directlyChangedPackages);
  const repositoryOwners =
    lane === "fast"
      ? changedFiles.flatMap((path) => {
          if (path.startsWith("scripts/")) return ["repo:ci"];
          if (path.startsWith("examples/")) return ["repo:examples"];
          if (path.startsWith("tests/")) return ["repo:tests"];
          return [];
        })
      : [];
  const owners = [
    ...new Set([
      ...repositoryOwners,
      ...TEST_INVENTORY.tests
        .filter((entry) => entry.lane === lane)
        .filter((entry) => affectedPackages.has(entry.owner))
        .map(({ owner }) => owner),
    ]),
  ].sort();
  return { applicable: owners.length > 0, owners, full: false };
}

export function generatedTestMaterializationArguments(
  requiredGeneratedPaths: readonly string[],
): readonly string[] {
  if (requiredGeneratedPaths.length === 0) return [];
  return [
    "--materialization-evidence",
    "ci-reports/generated-apps/materialization-evidence.json",
    "--generated-root",
    "ci-reports/generated-apps/materialized-tests",
    ...requiredGeneratedPaths.flatMap((path) => ["--required-generated-path", path]),
  ];
}

const repoOnly = (
  context: VerificationContext,
  profile: VerificationProfile,
  suppressVerificationContractTests = false,
): readonly EvidenceCommand[] => [
  {
    id: "verification-policy",
    label: "Read-only verification policy",
    category: "quality",
    command: guardedNodeScript(
      "Guard or classify the reported verification path",
      "scripts/verification-policy.mts",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "test-inventory",
    label: "Authoritative test inventory",
    category: "quality",
    command: guardedNodeScript(
      "node --experimental-strip-types scripts/test-inventory.mts --write",
      "scripts/test-inventory.mts",
      "--check",
      "--profile",
      profile === "publish" ? "publish" : "ordinary",
      "--output",
      "ci-reports/package-quality/test-inventory.json",
    ),
    timeoutMs: minutes(5),
    artifacts: [
      {
        label: "Resolved test inventory",
        path: "ci-reports/package-quality/test-inventory.json",
        required: true,
      },
    ],
  },
  {
    id: "turbo-cache-contract",
    label: "Turbo cache reuse and invalidation contract",
    category: "quality",
    command: nodeScript("scripts/turbo-cache-contract.mts"),
    timeoutMs: minutes(5),
  },
  {
    id: "verification-contract-tests",
    label: "Verification profile contracts",
    category: "quality",
    command: [
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
      "scripts/tests/test-inventory.spec.ts",
      "scripts/tests/test-lane-runner.spec.ts",
      "scripts/tests/turbo-cache-contract.spec.ts",
    ],
    timeoutMs: minutes(10),
    applicable: !suppressVerificationContractTests,
  },
  {
    id: "changeset-required",
    label: "Changeset requirement",
    category: "metadata",
    command: guardedNodeScript(
      "pnpm changeset or revert the publishable change",
      "scripts/changeset-required-check.mts",
      ...(context.base && context.head ? ["--base", context.base, "--head", context.head] : []),
    ),
    timeoutMs: minutes(5),
    applicable: Boolean(context.base && context.head),
  },
  {
    id: "package-manifests",
    label: "Package manifests",
    category: "metadata",
    command: guarded("pnpm package-manifests:write", [
      "node",
      "scripts/normalize-packages.mjs",
      "--check",
    ]),
    timeoutMs: minutes(5),
  },
  {
    id: "release-version-sync",
    label: "Release version-derived metadata",
    category: "metadata",
    command: guardedNodeScript(
      "pnpm release-version-sync:write && pnpm docs:catalog:write",
      "scripts/release-version-sync.mts",
      "--check",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "docs-catalog",
    label: "Package documentation catalog",
    category: "quality",
    command: guardedNodeScript(
      "pnpm docs:catalog:write",
      "scripts/package-docs-check.mts",
      "--check",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "docs-api-triggers",
    label: "API documentation triggers",
    category: "quality",
    command: guardedNodeScript(
      "pnpm docs:api-triggers:write",
      "scripts/api-docs-trigger-check.mts",
      "--check",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "problem-registry",
    label: "Problem registry",
    category: "quality",
    command: guardedNodeScript(
      "pnpm problem-registry:write",
      "scripts/problem-registry.mts",
      "--check",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "docs-examples",
    label: "Documentation examples",
    category: "quality",
    command: guardedNodeScript(
      "pnpm docs:examples:write",
      "scripts/doc-examples-check.mts",
      "--check",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "release-docs",
    label: "Release documentation",
    category: "quality",
    command: guardedNodeScript(
      "Fix the reported release documentation contract",
      "scripts/release-docs-check.mts",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "ci-executables",
    label: "CI executable supply chain",
    category: "security",
    command: guardedNodeScript(
      "Pin the reported CI executable to an immutable source",
      "scripts/ci-executable-policy.mts",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "ci-performance-budget",
    label: "Pull-request CI performance budget",
    category: "quality",
    command: nodeScript("scripts/ci-performance-budget.mts"),
    timeoutMs: minutes(5),
  },
  {
    id: "architecture-policy-runtime",
    label: "Verification runtime prerequisites",
    category: "build",
    command: guarded("Fix the verification runtime build prerequisites", [
      "pnpm",
      "--filter",
      "@croco/architecture-policy...",
      "--filter",
      "@croco/tenant-core...",
      "build",
    ]),
    timeoutMs: minutes(10),
  },
  {
    id: "architecture-policy",
    label: "Architecture policy",
    category: "quality",
    command: guardedNodeScript(
      "Fix the reported architecture violation",
      "scripts/architecture-policy-check.mts",
      "--manifest",
      "croco.arch.json",
    ),
    timeoutMs: minutes(10),
  },
  {
    id: "architecture-circular-allowlist",
    label: "Architecture circular allowlist",
    category: "quality",
    command: guardedNodeScript(
      "Update code or intentionally update the circular dependency allowlist",
      "scripts/verify-circular-allowlist.mts",
    ),
    timeoutMs: minutes(10),
  },
  {
    id: "dependency-boundaries",
    label: "Dependency boundaries",
    category: "quality",
    command: guardedNodeScript(
      "Fix the reported package boundary",
      "scripts/package-quality-report.mts",
      "--boundary-check-only",
    ),
    timeoutMs: minutes(10),
  },
  {
    id: "security-allowlists",
    label: "Security allowlists",
    category: "quality",
    command: guardedNodeScript(
      "Fix the reported security allowlist metadata",
      "scripts/security-allowlist-metadata-check.mts",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "generated-secret-placeholders",
    label: "Generated secret placeholders",
    category: "quality",
    command: guardedNodeScript(
      "Fix the reported template placeholder",
      "scripts/generated-secret-placeholder-policy.mts",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "compiler-baseline",
    label: "TypeScript compiler baseline",
    category: "typecheck",
    command: guardedNodeScript(
      "Restore the documented TypeScript compiler and tsconfig contract",
      "scripts/compiler-baseline-check.mts",
    ),
    timeoutMs: minutes(5),
  },
  {
    id: "decorator-signature-spike",
    label: "Legacy decorator signature spike",
    category: "typecheck",
    command: guardedNodeScript(
      "Restore the reviewed TypeScript 6 decorator signature fixtures and policy",
      "scripts/decorator-signature-spike.mts",
    ),
    timeoutMs: minutes(10),
  },
  {
    id: "strict-contract-typecheck",
    label: "Strict contract typecheck",
    category: "typecheck",
    command: guardedNodeScript(
      "Fix the reported strict contract diagnostic",
      "scripts/strict-contract-typecheck.mts",
    ),
    timeoutMs: minutes(10),
  },
  {
    id: "static-misuse",
    label: "Static misuse",
    category: "quality",
    command: guardedNodeScript("Fix the reported source misuse", "scripts/static-misuse-check.mts"),
    timeoutMs: minutes(10),
  },
  {
    id: "lint",
    label: "Lint",
    category: "quality",
    command: ["pnpm", "exec", "oxlint", "."],
    timeoutMs: minutes(15),
  },
  {
    id: "format",
    label: "Format",
    category: "quality",
    command: [
      "pnpm",
      "exec",
      "oxfmt",
      "--check",
      ".",
      "--ignore-path=.gitignore",
      "--ignore-path=.prettierignore",
      "--ignore-path=.oxfmtignore",
    ],
    timeoutMs: minutes(15),
  },
  {
    id: "architecture-circular",
    label: "Architecture circular dependencies",
    category: "quality",
    command: guarded("Fix the reported circular dependency", [
      "pnpm",
      "exec",
      "madge",
      "--circular",
      "--extensions",
      "ts",
      "packages",
    ]),
    timeoutMs: minutes(10),
  },
  {
    id: "benchmark-thresholds",
    label: "Benchmark thresholds",
    category: "quality",
    command: guardedNodeScript("pnpm bench:update", "scripts/bench-threshold-check.mts"),
    timeoutMs: minutes(10),
  },
];

const spineOnly = (
  context: VerificationContext,
  profile: VerificationProfile,
): readonly EvidenceCommand[] => {
  const changeScoped = isChangeScopedVerification(context);
  const packageAccountability = packageAccountabilitySelection(context);
  const affectedArguments =
    profile === "publish" || packageAccountability.fullEvidence
      ? []
      : affectedTurboArguments(context);
  const scaffoldApplicable = isApplicableToChangedFiles(context, affectsScaffold);
  const affectedGeneratedSmokeCases = context.changedFiles
    ? selectGeneratedSmokeCasesForChangedFiles(context.changedFiles)
    : [];
  const generatedAppSmokeFullTier = scaffoldApplicable || packageAccountability.fullEvidence;
  const generatedAppSmokeApplicable =
    generatedAppSmokeFullTier || affectedGeneratedSmokeCases.length > 0;
  const selectedGeneratedSmokeCases =
    profile === "publish"
      ? PUBLISH_REQUIRED_GENERATED_SMOKE_CASES
      : generatedAppSmokeFullTier
        ? GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "spine-blocking").map(
            ({ name }) => name,
          )
        : affectedGeneratedSmokeCases;
  const generatedTestPaths = TEST_INVENTORY.tests
    .filter(({ lane }) => lane === "generated-app")
    .map(({ path }) => path);
  const requiredGeneratedPaths = selectGeneratedTestPathsForSmokeCases(
    selectedGeneratedSmokeCases,
    generatedTestPaths,
  );
  const scaffoldBuildArguments =
    changeScoped && scaffoldApplicable && !packageAccountability.fullEvidence
      ? ["--filter=create-croco-app"]
      : [];
  const entrypointsApplicable = isApplicableToChangedFiles(context, affectsPackageEntrypoints);
  const binsApplicable = isApplicableToChangedFiles(context, affectsPackageBins);
  const packageBinBuildArguments =
    changeScoped && binsApplicable && !packageAccountability.fullEvidence
      ? PACKAGE_BIN_BUILD_FILTERS.map((packageName) => `--filter=${packageName}`)
      : [];
  const packedCliApplicable = isApplicableToChangedFiles(context, affectsCreateCrocoApp);
  const coreCoverageApplicable = isApplicableToChangedFiles(context, affectsCoreCoverage);
  const selectedFastLane = laneSelection(context, profile, "fast");
  const fastSelection = packageAccountability.fullEvidence
    ? { applicable: true, owners: [], full: true }
    : selectedFastLane;
  const integrationSelection = laneSelection(context, profile, "integration");
  const publishedSelection = laneSelection(context, profile, "published");

  return [
    {
      id: "build",
      label:
        changeScoped && !packageAccountability.fullEvidence ? "Affected build" : "Summarized build",
      category: "build",
      command: [
        "pnpm",
        "turbo",
        "run",
        "build",
        ...affectedArguments,
        ...scaffoldBuildArguments,
        ...packageBinBuildArguments,
        "--summarize",
        "--continue=always",
      ],
      timeoutMs: minutes(30),
    },
    {
      id: "quick-start-lambda-smoke",
      label: "Quick-start Lambda smoke",
      category: "runtime-smoke",
      command: nodeScript("scripts/quick-start-lambda-smoke.mts"),
      timeoutMs: minutes(10),
      applicable: scaffoldApplicable,
    },
    {
      id: "first-success",
      label: "First-success contract",
      category: "generated-app",
      command: guardedNodeScript(
        "Follow the reported scaffold or documentation recovery command",
        "scripts/first-success-verify.mts",
      ),
      timeoutMs: minutes(10),
      applicable: scaffoldApplicable,
    },
    {
      id: "package-entrypoints-smoke",
      label: "Package entrypoint smoke",
      category: "package-smoke",
      command: nodeScript(
        "scripts/package-entrypoint-smoke.mts",
        ...(changeScoped ? ["--build-missing"] : []),
      ),
      timeoutMs: minutes(15),
      applicable: entrypointsApplicable,
    },
    {
      id: "package-bins-smoke",
      label: "Package binary smoke",
      category: "package-smoke",
      command: nodeScript("scripts/package-bin-smoke.mts"),
      timeoutMs: minutes(20),
      applicable: binsApplicable,
    },
    {
      id: "generated-app-smoke",
      label: "create-croco-app spine smoke",
      category: "generated-app",
      command: nodeScript(
        "scripts/create-croco-app-generated-smoke.mts",
        ...(profile === "publish"
          ? PUBLISH_REQUIRED_GENERATED_SMOKE_CASES
          : generatedAppSmokeFullTier
            ? ["--tier", "spine-blocking"]
            : affectedGeneratedSmokeCases),
      ),
      timeoutMs: minutes(45),
      applicable: generatedAppSmokeApplicable,
      artifacts: [
        {
          label: "Spine-blocking generated app smoke matrix markdown",
          path: "ci-reports/generated-apps/spine-blocking-matrix.md",
          required: true,
        },
        {
          label: "Spine-blocking generated app smoke matrix JSON",
          path: "ci-reports/generated-apps/spine-blocking-matrix.json",
          required: true,
        },
        {
          label: "Generated app smoke journey bundle",
          path: "ci-reports/generated-apps/spine-blocking-journeys",
          required: generatedAppSmokeFullTier && profile !== "publish",
          copyRelativePath: "spine-blocking-journeys",
        },
        {
          label: "Generated test materialization evidence",
          path: "ci-reports/generated-apps/materialization-evidence.json",
          required: true,
        },
        {
          label: "Generated test materializations",
          path: "ci-reports/generated-apps/materialized-tests",
          required: true,
        },
      ],
    },
    {
      id: "alpha-release-smoke",
      label: "Packed generated app release smoke",
      category: "generated-app",
      command: nodeScript("scripts/alpha-release-smoke.mts"),
      timeoutMs: minutes(45),
      applicable: !changeScoped,
      artifacts: [
        {
          label: "Packed generated app smoke report",
          path: "ci-reports/release/alpha-release-smoke.md",
          required: true,
        },
      ],
    },
    {
      id: "typecheck",
      label: "Summarized TypeScript check",
      category: "typecheck",
      command: guarded("Fix the reported TypeScript diagnostics", [
        "pnpm",
        "turbo",
        "run",
        "typecheck",
        "--only",
        ...affectedArguments,
        "--summarize",
        "--continue=always",
      ]),
      timeoutMs: minutes(30),
    },
    {
      id: "test",
      label: "Summarized tests",
      category: "quality",
      command: nodeScript(
        "scripts/test-lane-runner.mts",
        "--lane",
        "fast",
        ...fastSelection.owners.flatMap((owner) => ["--owner", owner]),
        "--output",
        "ci-reports/package-quality/fast-test-lane.json",
      ),
      timeoutMs: minutes(45),
      applicable: fastSelection.applicable,
      artifacts: [
        {
          label: "Fast test lane evidence",
          path: "ci-reports/package-quality/fast-test-lane.json",
          required: true,
        },
      ],
    },
    {
      id: "integration-test-lane",
      label: "Inventory integration test lane",
      category: "quality",
      command: nodeScript(
        "scripts/test-lane-runner.mts",
        "--lane",
        "integration",
        ...integrationSelection.owners.flatMap((owner) => ["--owner", owner]),
        "--output",
        "ci-reports/package-quality/integration-test-lane.json",
      ),
      timeoutMs: minutes(30),
      applicable: integrationSelection.applicable,
      selectionReason: integrationSelection.full
        ? "Selected for the full integration inventory."
        : `Selected affected integration owners: ${integrationSelection.owners.join(", ")}.`,
      artifacts: [
        {
          label: "Integration test lane evidence",
          path: "ci-reports/package-quality/integration-test-lane.json",
          required: true,
        },
      ],
    },
    {
      id: "published-test-lane",
      label: "Inventory published-consumer test lane",
      category: "package-smoke",
      command: nodeScript(
        "scripts/test-lane-runner.mts",
        "--lane",
        "published",
        ...publishedSelection.owners.flatMap((owner) => ["--owner", owner]),
        "--output",
        "ci-reports/package-quality/published-test-lane.json",
      ),
      timeoutMs: minutes(45),
      applicable: publishedSelection.applicable,
      selectionReason: publishedSelection.full
        ? "Selected for the full published-consumer inventory."
        : `Selected affected published owners: ${publishedSelection.owners.join(", ")}.`,
      artifacts: [
        {
          label: "Published-consumer test lane evidence",
          path: "ci-reports/package-quality/published-test-lane.json",
          required: true,
        },
      ],
    },
    {
      id: "test-evidence-reconcile",
      label: "Enforced test execution evidence",
      category: "quality",
      command: nodeScript(
        "scripts/test-evidence-reconcile.mts",
        "--profile",
        profile === "publish" ? "publish" : "ordinary",
        ...[...new Set([...fastSelection.owners, ...integrationSelection.owners])].flatMap(
          (owner) => ["--affected-owner", owner],
        ),
        ...publishedSelection.owners.flatMap((owner) => ["--packaging-owner", owner]),
        ...(fastSelection.applicable
          ? ["--lane-report", "ci-reports/package-quality/fast-test-lane.json"]
          : []),
        ...(integrationSelection.applicable
          ? ["--lane-report", "ci-reports/package-quality/integration-test-lane.json"]
          : []),
        ...(publishedSelection.applicable
          ? ["--lane-report", "ci-reports/package-quality/published-test-lane.json"]
          : []),
        ...(generatedAppSmokeApplicable
          ? generatedTestMaterializationArguments(requiredGeneratedPaths)
          : []),
        "--output",
        "ci-reports/package-quality/test-evidence.json",
      ),
      timeoutMs: minutes(5),
      artifacts: [
        {
          label: "Enforced test evidence",
          path: "ci-reports/package-quality/test-evidence.json",
          required: true,
        },
      ],
    },
    {
      id: "cli-packed-e2e",
      label: integrationSelection.full
        ? "Packed installed CLI integration evidence"
        : "Packed installed CLI integration tests",
      category: "quality",
      command: integrationSelection.full
        ? nodeScript(
            "scripts/test-lane-evidence-check.mts",
            "--report",
            "ci-reports/package-quality/integration-test-lane.json",
            "--lane",
            "integration",
            "--path",
            "packages/cli/src/tests/integration/CliCommandIntegration.spec.ts",
          )
        : [
            "pnpm",
            "--dir=packages/cli",
            "exec",
            "vitest",
            "run",
            "src/tests/integration/CliCommandIntegration.spec.ts",
          ],
      timeoutMs: minutes(integrationSelection.full ? 2 : 15),
      applicable: packedCliApplicable,
    },
    {
      id: "provider-certification",
      label: "Provider certification",
      category: "quality",
      command: guardedNodeScript(
        "Fix the reported provider certification metadata",
        "scripts/provider-certification-check.mts",
      ),
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Provider certification markdown",
          path: "ci-reports/package-quality/provider-certification.md",
          required: true,
        },
        {
          label: "Provider certification JSON",
          path: "ci-reports/package-quality/provider-certification.json",
          required: true,
        },
      ],
    },
    {
      id: "production-ready",
      label: "Production-ready package evidence",
      category: "quality",
      command: guardedNodeScript(
        "Fix the reported production-ready package violations",
        "scripts/production-ready-check.mts",
        ...(packageAccountability.fullEvidence
          ? [
              "--require-task-summaries",
              "--fast-test-lane-report",
              "ci-reports/package-quality/fast-test-lane.json",
            ]
          : []),
      ),
      timeoutMs: minutes(10),
      applicable: packageAccountability.applicable,
      selectionReason: packageAccountability.reason,
      artifacts: [
        {
          label: "Production-ready package markdown",
          path: "ci-reports/package-quality/production-ready.md",
          required: true,
        },
      ],
    },
    {
      id: "spine-promotion",
      label: "Beta spine promotion accountability",
      category: "quality",
      command: guardedNodeScript(
        "Fix the reported beta spine promotion violations",
        "scripts/spine-promotion-check.mts",
        ...(packageAccountability.fullEvidence
          ? []
          : packageAccountability.packages.flatMap((packageName) => ["--package", packageName])),
      ),
      timeoutMs: minutes(10),
      applicable: packageAccountability.applicable,
      selectionReason: packageAccountability.reason,
      artifacts: [
        {
          label: "Beta spine promotion markdown",
          path: "ci-reports/package-quality/spine-promotion.md",
          required: true,
        },
      ],
    },
    {
      id: "core-coverage",
      label: "Core coverage gate",
      category: "coverage",
      command: [
        "pnpm",
        ...CORE_COVERAGE_PACKAGES.flatMap((packageName) => ["--filter", packageName]),
        "exec",
        "vitest",
        "run",
        "--coverage",
        "--config",
        "../../vitest.config.ts",
      ],
      timeoutMs: minutes(45),
      applicable: coreCoverageApplicable,
    },
    {
      id: "core-coverage-warning",
      label: "Core coverage warning report",
      category: "coverage",
      command: nodeScript("scripts/core-coverage-warning-check.mts"),
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Core coverage warning markdown",
          path: "ci-reports/coverage/core-warning/report.md",
          required: true,
        },
      ],
    },
    {
      id: "public-api",
      label: "Public API snapshot",
      category: "public-api",
      command: guardedNodeScript(
        "pnpm public-api:write",
        "scripts/public-api-surface.mts",
        "--check",
      ),
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Public API diff markdown",
          path: "ci-reports/package-quality/public-api-diff.md",
          required: true,
        },
        {
          label: "Public API summary JSON",
          path: "ci-reports/package-quality/public-api-summary.json",
          required: true,
        },
      ],
    },
  ];
};

const publishOnly = (context: VerificationContext): readonly EvidenceCommand[] => [
  {
    id: "release-gate-tests",
    label: "Release-gate maintenance test evidence",
    category: "quality",
    command: nodeScript(
      "scripts/test-lane-evidence-check.mts",
      "--report",
      "ci-reports/package-quality/fast-test-lane.json",
      "--lane",
      "fast",
      ...RELEASE_GATE_TEST_PATHS.flatMap((path) => ["--path", path]),
    ),
    timeoutMs: minutes(2),
    applicable: isApplicableToChangedFiles(context, isReleaseGateMaintenancePath),
  },
  {
    id: "release-metadata",
    label: "Release metadata",
    category: "metadata",
    command: nodeScript(
      "scripts/release-metadata-check.mts",
      ...(context.allowPendingReleaseMetadata ? ["--allow-pending-changesets"] : []),
    ),
    timeoutMs: minutes(10),
    applicable: isApplicableToChangedFiles(
      context,
      (path) =>
        path === "scripts/release-metadata-check.mts" ||
        /^\.changeset\/(?:pre\.json|(?!README\.md$)[^/]+\.md)$/.test(path) ||
        /^packages\/[^/]+\/(?:package\.json|CHANGELOG\.md)$/.test(path),
    ),
  },
  {
    id: "spine-bundle-size",
    label: "Spine bundle-size warning report",
    category: "quality",
    command: nodeScript("scripts/package-quality-report.mts"),
    timeoutMs: minutes(10),
    applicable: isApplicableToChangedFiles(
      context,
      (path) =>
        path === "scripts/package-quality-report.mts" ||
        path === ".changeset/config.json" ||
        path === "ci-reports/bundle-size/baseline.json" ||
        path === "docs/package-catalog.json" ||
        /^(?:pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|tsconfig(?:\.[^/]+)?\.json)$/.test(
          path,
        ) ||
        /^packages\/[^/]+\/(?:src|config)\//.test(path) ||
        /^packages\/[^/]+\/(?:package\.json|tsconfig[^/]*\.json)$/.test(path),
    ),
    artifacts: [
      {
        label: "Package quality dashboard markdown",
        path: "ci-reports/package-quality/report.md",
        required: true,
      },
      {
        label: "Package quality dashboard JSON",
        path: "ci-reports/package-quality/summary.json",
        required: true,
      },
      {
        label: "Bundle-size enforcement markdown",
        path: "ci-reports/package-quality/bundle-size.md",
        required: true,
      },
    ],
  },
  {
    id: "dependency-audit-policy",
    label: "Production dependency audit policy",
    category: "quality",
    command: nodeScript("scripts/dependency-audit-policy.mts"),
    timeoutMs: minutes(10),
  },
  {
    id: "provenance-config",
    label: "npm provenance configuration",
    category: "metadata",
    command: nodeScript("scripts/provenance-config-check.mts"),
    timeoutMs: minutes(5),
  },
  {
    id: "publish-dry-run",
    label: "Publish dry run",
    category: "metadata",
    command: ["pnpm", "-r", "publish", "--dry-run", "--no-git-checks"],
    timeoutMs: minutes(30),
  },
];

const PROHIBITED_ROOT_ALIASES = new Set([
  "check",
  "build",
  "test",
  "typecheck",
  "release:spine-evidence",
]);

const PACKAGE_QUALITY_STATUS_PREREQUISITES = [
  "changeset-required",
  "lint",
  "format",
  "build",
  "typecheck",
  "test",
  "provider-certification",
  "production-ready",
  "spine-promotion",
] as const;

const VERIFICATION_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  "architecture-policy": ["architecture-policy-runtime"],
  build: ["architecture-policy-runtime"],
  "quick-start-lambda-smoke": ["build"],
  "first-success": ["build"],
  "package-entrypoints-smoke": ["build", "test"],
  "package-bins-smoke": ["build"],
  "generated-app-smoke": ["build"],
  "alpha-release-smoke": ["build"],
  typecheck: ["build"],
  test: ["build", "typecheck"],
  "integration-test-lane": ["build"],
  "published-test-lane": ["build"],
  "test-evidence-reconcile": [
    "test",
    "integration-test-lane",
    "published-test-lane",
    "generated-app-smoke",
  ],
  "cli-packed-e2e": ["integration-test-lane"],
  "production-ready": ["build", "typecheck", "test", "test-evidence-reconcile"],
  "spine-promotion": ["test", "generated-app-smoke", "provider-certification", "production-ready"],
  "core-coverage": ["build"],
  "core-coverage-warning": ["core-coverage"],
  "spine-bundle-size": PACKAGE_QUALITY_STATUS_PREREQUISITES,
  "release-gate-tests": ["test"],
  "publish-dry-run": ["build"],
};

const WORKSPACE_ARTIFACT_CONCURRENCY_GROUP = new Set([
  "package-entrypoints-smoke",
  "package-bins-smoke",
  "generated-app-smoke",
  "alpha-release-smoke",
  "integration-test-lane",
  "published-test-lane",
  "cli-packed-e2e",
  "core-coverage",
  "publish-dry-run",
]);

function withSchedulingContract(command: EvidenceCommand): EvidenceCommand {
  const dependsOn = VERIFICATION_DEPENDENCIES[command.id];
  return {
    ...command,
    ...(dependsOn ? { dependsOn } : {}),
    ...(WORKSPACE_ARTIFACT_CONCURRENCY_GROUP.has(command.id)
      ? { concurrencyGroup: "workspace-artifacts" }
      : {}),
  };
}

export function assertVerificationManifest(commands: readonly EvidenceCommand[]): void {
  const seen = new Set<string>();
  const indexes = new Map<string, number>();
  for (const [index, command] of commands.entries()) {
    indexes.set(command.id, index);
  }
  for (const command of commands) {
    if (seen.has(command.id)) {
      throw new VerificationProblem(
        "DUPLICATE_VERIFICATION_COMMAND_ID",
        "contract",
        `Duplicate verification command ID: ${command.id}`,
      );
    }
    seen.add(command.id);
    if (command.command[0] === "pnpm") {
      const invoked = command.command[1];
      if (invoked && (PROHIBITED_ROOT_ALIASES.has(invoked) || invoked.startsWith("verify:"))) {
        throw new VerificationProblem(
          "COMPOSITE_VERIFICATION_ALIAS",
          "contract",
          `Composite root alias is not allowed in verification manifest: ${invoked}`,
        );
      }
    }
    if (command.concurrencyGroup !== undefined && command.concurrencyGroup.trim().length === 0) {
      throw new VerificationProblem(
        "EMPTY_VERIFICATION_CONCURRENCY_GROUP",
        "contract",
        `Verification command ${command.id} has an empty concurrency group.`,
      );
    }
    for (const dependency of command.dependsOn ?? []) {
      if (dependency === command.id) {
        throw new VerificationProblem(
          "SELF_VERIFICATION_DEPENDENCY",
          "contract",
          `Verification command ${command.id} cannot depend on itself.`,
        );
      }
      if (!indexes.has(dependency)) {
        throw new VerificationProblem(
          "UNKNOWN_VERIFICATION_DEPENDENCY",
          "contract",
          `Verification command ${command.id} depends on unknown command ${dependency}.`,
        );
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byId = new Map(commands.map((command) => [command.id, command]));
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new VerificationProblem(
        "CYCLIC_VERIFICATION_DEPENDENCY",
        "contract",
        `Verification command dependency graph contains a cycle involving ${id}.`,
      );
    }
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const command of commands) visit(command.id);

  const spineBundleIndex = indexes.get("spine-bundle-size");
  if (spineBundleIndex !== undefined) {
    const spineBundle = byId.get("spine-bundle-size");
    for (const prerequisiteId of PACKAGE_QUALITY_STATUS_PREREQUISITES) {
      if (!spineBundle?.dependsOn?.includes(prerequisiteId)) {
        throw new VerificationProblem(
          "PACKAGE_QUALITY_STATUS_DEPENDENCY",
          "contract",
          `${prerequisiteId} must be a prerequisite of spine-bundle-size so package quality dashboard status values are already known.`,
        );
      }
    }
  }
}

export function createVerificationManifest(
  profile: VerificationProfile,
  context: VerificationContext = {},
): readonly EvidenceCommand[] {
  const releaseGateMaintenance = isApplicableToChangedFiles(context, isReleaseGateMaintenancePath);
  const repo = repoOnly(context, profile, profile === "publish" && releaseGateMaintenance);
  const spine = spineOnly(context, profile);
  const commands = (
    profile === "repo"
      ? repo
      : profile === "spine"
        ? [...repo, ...spine]
        : [...repo, ...spine, ...publishOnly(context)]
  ).map(withSchedulingContract);
  assertVerificationManifest(commands);
  return commands;
}

export function getVerificationCommand(
  id: string,
  context: VerificationContext = {},
): EvidenceCommand {
  const command = createVerificationManifest("publish", context).find(
    (candidate) => candidate.id === id,
  );
  if (!command) {
    throw new VerificationProblem(
      "UNKNOWN_VERIFICATION_COMMAND_ID",
      "input",
      `Unknown verification command ID: ${id}`,
    );
  }
  return command;
}

export function verificationImplementationPaths(): readonly string[] {
  const paths = new Set<string>();
  for (const definition of createVerificationManifest("publish")) {
    for (const argument of definition.command) {
      if (/^scripts\/[^/]+\.(?:mts|mjs|ts)$/.test(argument)) paths.add(argument);
    }
  }
  return [...paths].sort();
}
