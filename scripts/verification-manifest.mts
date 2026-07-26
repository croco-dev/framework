import type { EvidenceCommand } from "./release-spine-evidence.mts";
import {
  isReleaseGateMaintenancePath,
  RELEASE_GATE_TEST_PATHS,
} from "./release-gate-maintenance.mts";
import { VerificationProblem } from "./verification-problem.mts";

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

function isApplicableToChangedFiles(
  context: VerificationContext,
  predicate: (path: string) => boolean,
): boolean {
  if (!context.base || !context.head || !context.changedFiles) return true;
  return context.changedFiles.some(predicate);
}

const repoOnly = (
  context: VerificationContext,
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
      "scripts/tests/release-workflow.spec.ts",
      "scripts/tests/verification-policy.spec.ts",
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
    id: "architecture-policy-runtime",
    label: "Architecture policy runtime prerequisite",
    category: "build",
    command: guarded("Fix the @croco/problems-core build prerequisite", [
      "pnpm",
      "--filter",
      "@croco/problems-core",
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

const SPINE_ONLY: readonly EvidenceCommand[] = [
  {
    id: "build",
    label: "Summarized build",
    category: "build",
    command: ["pnpm", "turbo", "run", "build", "--summarize", "--continue=always"],
    timeoutMs: minutes(30),
  },
  {
    id: "quick-start-lambda-smoke",
    label: "Quick-start Lambda smoke",
    category: "runtime-smoke",
    command: nodeScript("scripts/quick-start-lambda-smoke.mts"),
    timeoutMs: minutes(10),
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
  },
  {
    id: "package-entrypoints-smoke",
    label: "Package entrypoint smoke",
    category: "package-smoke",
    command: nodeScript("scripts/package-entrypoint-smoke.mts"),
    timeoutMs: minutes(10),
  },
  {
    id: "package-bins-smoke",
    label: "Package binary smoke",
    category: "package-smoke",
    command: nodeScript("scripts/package-bin-smoke.mts"),
    timeoutMs: minutes(20),
  },
  {
    id: "generated-app-smoke",
    label: "create-croco-app spine smoke",
    category: "generated-app",
    command: nodeScript("scripts/create-croco-app-generated-smoke.mts", "--tier", "spine-blocking"),
    timeoutMs: minutes(45),
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
        required: true,
        copyRelativePath: "spine-blocking-journeys",
      },
    ],
  },
  {
    id: "alpha-release-smoke",
    label: "Packed generated app release smoke",
    category: "generated-app",
    command: nodeScript("scripts/alpha-release-smoke.mts"),
    timeoutMs: minutes(45),
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
      "--summarize",
      "--continue=always",
    ]),
    timeoutMs: minutes(30),
  },
  {
    id: "test",
    label: "Summarized tests",
    category: "quality",
    command: ["pnpm", "turbo", "run", "test", "--summarize", "--continue=always"],
    timeoutMs: minutes(45),
  },
  {
    id: "cli-e2e",
    label: "CLI integration tests",
    category: "quality",
    command: ["pnpm", "--filter", "@croco/cli", "test:e2e"],
    timeoutMs: minutes(15),
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
      "--require-task-summaries",
    ),
    timeoutMs: minutes(10),
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
    ),
    timeoutMs: minutes(10),
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
      "--filter",
      "@croco/framework-context",
      "--filter",
      "@croco/problems-core",
      "--filter",
      "@croco/protocols-core",
      "--filter",
      "@croco/protocols-rest",
      "--filter",
      "@croco/openapi-spec",
      "--filter",
      "@croco/rpc-codegen",
      "--filter",
      "@croco/transports-http",
      "--filter",
      "@croco/telemetry-api",
      "--filter",
      "@croco/telemetry-sdk-node",
      "--filter",
      "@croco/tx-core",
      "--filter",
      "@croco/tx-drizzle",
      "--filter",
      "@croco/events-core",
      "--filter",
      "@croco/events-tx",
      "--filter",
      "@croco/retry-core",
      "--filter",
      "@croco/idempotency-core",
      "--filter",
      "@croco/testing",
      "--filter",
      "create-croco-app",
      "--filter",
      "@croco/cli",
      "--filter",
      "@croco/auth-core",
      "exec",
      "vitest",
      "run",
      "--coverage",
      "--config",
      "../../vitest.config.ts",
    ],
    timeoutMs: minutes(45),
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

const publishOnly = (context: VerificationContext): readonly EvidenceCommand[] => [
  {
    id: "release-gate-tests",
    label: "Release-gate maintenance tests",
    category: "quality",
    command: [
      "pnpm",
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      ...RELEASE_GATE_TEST_PATHS,
      "--config",
      "vitest.config.ts",
    ],
    timeoutMs: minutes(30),
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
] as const;

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
  }
  const spineBundleIndex = indexes.get("spine-bundle-size");
  if (spineBundleIndex !== undefined) {
    for (const prerequisiteId of PACKAGE_QUALITY_STATUS_PREREQUISITES) {
      const prerequisiteIndex = indexes.get(prerequisiteId);
      if (prerequisiteIndex === undefined || prerequisiteIndex > spineBundleIndex) {
        throw new VerificationProblem(
          "PACKAGE_QUALITY_STATUS_ORDER",
          "contract",
          `${prerequisiteId} must appear before spine-bundle-size so package quality dashboard status values are already known.`,
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
  const repo = repoOnly(context, profile === "publish" && releaseGateMaintenance);
  const commands =
    profile === "repo"
      ? repo
      : profile === "spine"
        ? [...repo, ...SPINE_ONLY]
        : [...repo, ...SPINE_ONLY, ...publishOnly(context)];
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
