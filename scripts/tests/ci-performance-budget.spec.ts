import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findCiPerformanceBudgetViolations,
  PR_CI_TARGET_MINUTES,
  pullRequestCiDesignBudgetMinutes,
} from "../ci-performance-budget.mts";
import { createVerificationManifest } from "../verification-manifest.mts";

const ROOT_DIR = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(resolve(ROOT_DIR, ".github/workflows/ci.yml"), "utf8");
const ORDINARY_PR_MANIFEST = createVerificationManifest("spine", {
  base: "origin/trunk",
  changedFiles: ["packages/customer-health-core/src/libs/CustomerHealthScore.ts"],
  head: "HEAD",
});
const MAINTENANCE_PR_MANIFEST = createVerificationManifest("publish", {
  base: "origin/trunk",
  changedFiles: [
    ".github/workflows/ci.yml",
    "scripts/ci-performance-budget.mts",
    "scripts/tests/ci-workflow.spec.ts",
    "scripts/verification-manifest.mts",
  ],
  head: "HEAD",
});

describe("pull-request CI performance budget", () => {
  it("keeps the ordinary PR critical path within the design budget", () => {
    expect(pullRequestCiDesignBudgetMinutes()).toBeLessThanOrEqual(PR_CI_TARGET_MINUTES);
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: WORKFLOW,
      }),
    ).toEqual([]);
  });

  it("rejects broad Windows and advisory PR routing", () => {
    const mutant = WORKFLOW.replace(
      "if: github.event_name == 'workflow_dispatch' && needs.changes.outputs.profile != 'repo'",
      "if: needs.changes.outputs.profile != 'repo'",
    ).replace("              - 'packages/create-croco-app/**'", "              - 'packages/**'");
    const violations = findCiPerformanceBudgetViolations({
      maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
      ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
      workflow: mutant,
    });

    expect(violations).toContain("ecosystem advisory smoke must stay off automatic change runs");
    expect(violations).toContain("Windows scaffold must not be triggered by every package change");
  });

  it("rejects an unfiltered ordinary package validation graph", () => {
    const manifest = ORDINARY_PR_MANIFEST.map((command) =>
      command.id === "build"
        ? {
            ...command,
            command: command.command.filter((argument) => !argument.startsWith("--filter=")),
          }
        : command,
    );

    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: manifest,
        workflow: WORKFLOW,
      }),
    ).toContain("affected validation warm-up must filter from the pull-request base");
  });

  it("rejects restoring full-spine validation on trunk pushes", () => {
    const mutant = WORKFLOW.replace(
      'if [ "${{ github.event_name }}" != "workflow_dispatch" ]; then',
      'if [ "${{ github.event_name }}" = "pull_request" ]; then',
    );

    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: mutant,
      }),
    ).toContain("pull-request and trunk validation must both use the changed-file scope");
  });

  it("rejects package build artifact gates on CI-only maintenance", () => {
    const manifest = MAINTENANCE_PR_MANIFEST.map((command) =>
      command.id === "first-success" ? { ...command, applicable: true } : command,
    );

    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: manifest,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: WORKFLOW,
      }),
    ).toContain("first-success must not require package build artifacts for CI maintenance");
  });
});
