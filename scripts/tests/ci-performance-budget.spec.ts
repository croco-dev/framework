import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createMaintenancePullRequestManifest,
  createOrdinaryPullRequestManifest,
  findCiPerformanceBudgetViolations,
  PR_CI_TARGET_MINUTES,
  pullRequestCiDesignBudgetMinutes,
} from "../ci-performance-budget.mts";

const ROOT_DIR = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(resolve(ROOT_DIR, ".github/workflows/ci.yml"), "utf8");
const ORDINARY_PR_MANIFEST = createOrdinaryPullRequestManifest();
const MAINTENANCE_PR_MANIFEST = createMaintenancePullRequestManifest();

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

  it("rejects overlapping affected validation phases", () => {
    const manifest = ORDINARY_PR_MANIFEST.map((command) =>
      command.id === "build"
        ? {
            ...command,
            command: command.command.flatMap((argument) =>
              argument === "build" ? [argument, "typecheck", "test"] : [argument],
            ),
          }
        : command,
    );
    const violations = findCiPerformanceBudgetViolations({
      maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
      ordinaryPullRequestManifest: manifest,
      workflow: WORKFLOW,
    });

    expect(violations).toContain("affected validation warm-up must run only build");
  });

  it.each(["typecheck", "test"] as const)(
    "rejects build overlap in the %s evidence phase",
    (phase) => {
      const manifest = ORDINARY_PR_MANIFEST.map((command) =>
        command.id === phase
          ? {
              ...command,
              command: command.command.flatMap((argument) =>
                argument === phase ? ["build", argument] : [argument],
              ),
            }
          : command,
      );

      expect(
        findCiPerformanceBudgetViolations({
          maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
          ordinaryPullRequestManifest: manifest,
          workflow: WORKFLOW,
        }),
      ).toContain(`${phase} evidence must run only ${phase}`);
    },
  );

  it.each([
    ["build", "typecheck"],
    ["typecheck", "build"],
    ["test", "build"],
  ] as const)("rejects %s phase overlap after Turbo options", (phase, overlap) => {
    const manifest = ORDINARY_PR_MANIFEST.map((command) => {
      if (command.id !== phase) return command;

      const filterIndex = command.command.findIndex((argument) => argument.startsWith("--filter="));
      return {
        ...command,
        command: [
          ...command.command.slice(0, filterIndex + 1),
          overlap,
          ...command.command.slice(filterIndex + 1),
        ],
      };
    });

    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: manifest,
        workflow: WORKFLOW,
      }),
    ).toContain(
      phase === "build"
        ? "affected validation warm-up must run only build"
        : `${phase} evidence must run only ${phase}`,
    );
  });

  it("rejects affected validation phases that can run out of order", () => {
    const manifest = ORDINARY_PR_MANIFEST.map((command) => command);
    const typecheckIndex = manifest.findIndex(({ id }) => id === "typecheck");
    const testIndex = manifest.findIndex(({ id }) => id === "test");
    const reordered = [...manifest];
    [reordered[typecheckIndex], reordered[testIndex]] = [
      reordered[testIndex],
      reordered[typecheckIndex],
    ];

    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: reordered,
        workflow: WORKFLOW,
      }),
    ).toContain("affected validation must run build, typecheck, and test in order");
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
