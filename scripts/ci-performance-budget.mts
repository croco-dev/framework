#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createVerificationManifest } from "./verification-manifest.mts";
import type { EvidenceCommand } from "./release-spine-evidence.mts";

export const PR_CI_TARGET_MINUTES = 10;

export const PR_CI_DESIGN_BUDGETS = {
  affectedGraph: 6,
  cachedTaskEvidence: 0.5,
  repositoryContracts: 2,
  setupAndSecurity: 1,
} as const;

const HEAVY_ORDINARY_PR_CHECKS = [
  "alpha-release-smoke",
  "cli-e2e",
  "core-coverage",
  "first-success",
  "generated-app-smoke",
  "package-bins-smoke",
  "package-entrypoints-smoke",
  "quick-start-lambda-smoke",
] as const;

const BUILD_ARTIFACT_MAINTENANCE_CHECKS = [
  "cli-e2e",
  "first-success",
  "generated-app-smoke",
  "package-bins-smoke",
  "package-entrypoints-smoke",
  "production-ready",
  "quick-start-lambda-smoke",
  "spine-promotion",
] as const;

export type CiPerformanceBudgetInput = {
  readonly maintenancePullRequestManifest: readonly EvidenceCommand[];
  readonly ordinaryPullRequestManifest: readonly EvidenceCommand[];
  readonly workflow: string;
};

function jobSection(workflow: string, job: string, nextJob: string): string {
  const startMarker = `\n  ${job}:\n`;
  const endMarker = `\n  ${nextJob}:\n`;
  const start = workflow.indexOf(startMarker);
  const end = workflow.indexOf(endMarker, start + startMarker.length);
  return start === -1 ? "" : workflow.slice(start + 1, end === -1 ? undefined : end + 1);
}

export function pullRequestCiDesignBudgetMinutes(): number {
  return Object.values(PR_CI_DESIGN_BUDGETS).reduce((total, value) => total + value, 0);
}

export function createOrdinaryPullRequestManifest(): readonly EvidenceCommand[] {
  return createVerificationManifest("spine", {
    base: "origin/trunk",
    changedFiles: ["packages/customer-health-core/src/libs/CustomerHealthScore.ts"],
    head: "HEAD",
  });
}

export function createMaintenancePullRequestManifest(): readonly EvidenceCommand[] {
  return createVerificationManifest("publish", {
    base: "origin/trunk",
    changedFiles: [
      ".github/workflows/ci.yml",
      "scripts/ci-performance-budget.mts",
      "scripts/tests/ci-workflow.spec.ts",
      "scripts/verification-manifest.mts",
    ],
    head: "HEAD",
  });
}

export function findCiPerformanceBudgetViolations(
  input: CiPerformanceBudgetInput,
): readonly string[] {
  const violations: string[] = [];
  const validate = jobSection(input.workflow, "validate", "changes");
  const changes = jobSection(input.workflow, "changes", "ecosystem-advisory");
  const ecosystemAdvisory = jobSection(input.workflow, "ecosystem-advisory", "real-resource-tests");
  const realResources = jobSection(input.workflow, "real-resource-tests", "windows-scaffold");
  const windowsScaffold = jobSection(input.workflow, "windows-scaffold", "docs-sync-check");
  const docsSync = jobSection(input.workflow, "docs-sync-check", "docs-build");
  const byId = new Map(input.ordinaryPullRequestManifest.map((command) => [command.id, command]));
  const maintenanceById = new Map(
    input.maintenancePullRequestManifest.map((command) => [command.id, command]),
  );
  const affectedFilter = "--filter=...[origin/trunk]";
  const docsExclusion = "--filter=!@croco/docs";

  if (
    !ecosystemAdvisory.includes(
      "if: github.event_name == 'workflow_dispatch' && needs.changes.outputs.profile != 'repo'",
    )
  ) {
    violations.push("ecosystem advisory smoke must stay off automatic change runs");
  }
  if (changes.includes("- 'packages/**'")) {
    violations.push("Windows scaffold must not be triggered by every package change");
  }
  if (
    !windowsScaffold.includes(
      "if: github.event_name == 'workflow_dispatch' || needs.changes.outputs.windows-scaffold == 'true'",
    )
  ) {
    violations.push("Windows scaffold must retain targeted change and full manual coverage");
  }
  if (
    !realResources.includes(
      "if: github.event_name == 'workflow_dispatch' || needs.changes.outputs.real-resources == 'true'",
    )
  ) {
    violations.push("real-resource tests must use a targeted automatic-change gate");
  }
  if (
    validate.includes("membership-postgres:") ||
    validate.includes("Verify typed TestKernel resources")
  ) {
    violations.push("real-resource services must not start in the ordinary validate job");
  }
  if (
    !validate.includes('if [ "${{ github.event_name }}" != "workflow_dispatch" ]; then') ||
    !validate.includes('args+=(--base "$VERIFICATION_BASE" --head HEAD)')
  ) {
    violations.push("pull-request and trunk validation must both use the changed-file scope");
  }
  if (
    !docsSync.includes(
      "if: github.event_name != 'pull_request' && needs.changes.outputs.api-source == 'true'",
    )
  ) {
    violations.push("full generated API documentation drift checks must stay off package PRs");
  }

  const build = byId.get("build");
  for (const task of ["build", "typecheck", "test"]) {
    if (!build?.command.includes(task)) {
      violations.push(`affected validation warm-up must include ${task}`);
    }
  }
  if (!build?.command.includes(affectedFilter)) {
    violations.push("affected validation warm-up must filter from the pull-request base");
  }
  if (!build?.command.includes(docsExclusion)) {
    violations.push("affected validation must leave full docs compilation to the docs workflow");
  }
  for (const id of ["typecheck", "test"]) {
    if (!byId.get(id)?.command.includes(affectedFilter)) {
      violations.push(`${id} evidence must reuse the affected package graph`);
    }
    if (!byId.get(id)?.command.includes(docsExclusion)) {
      violations.push(`${id} evidence must leave full docs compilation to the docs workflow`);
    }
  }
  for (const id of HEAVY_ORDINARY_PR_CHECKS) {
    if (byId.get(id)?.applicable !== false) {
      violations.push(`${id} must be skipped for an unrelated package implementation change`);
    }
  }
  for (const id of BUILD_ARTIFACT_MAINTENANCE_CHECKS) {
    if (maintenanceById.get(id)?.applicable !== false) {
      violations.push(`${id} must not require package build artifacts for CI maintenance`);
    }
  }

  const designBudget = pullRequestCiDesignBudgetMinutes();
  if (designBudget > PR_CI_TARGET_MINUTES) {
    violations.push(
      `ordinary PR design budget is ${designBudget} minutes, above ${PR_CI_TARGET_MINUTES}`,
    );
  }

  return violations;
}

function main(): void {
  const root = resolve(import.meta.dirname, "..");
  const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const ordinaryPullRequestManifest = createOrdinaryPullRequestManifest();
  const maintenancePullRequestManifest = createMaintenancePullRequestManifest();
  const violations = findCiPerformanceBudgetViolations({
    maintenancePullRequestManifest,
    ordinaryPullRequestManifest,
    workflow,
  });

  if (violations.length > 0) {
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `PR CI performance budget passed: ${pullRequestCiDesignBudgetMinutes()}/${PR_CI_TARGET_MINUTES} minutes`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
