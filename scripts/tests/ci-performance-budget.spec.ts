import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  calculateCiPerformanceStatistics,
  ciPerformancePartition,
  ciPerformancePartitionKey,
  createCiPerformanceBaselineCandidate,
  createCiPerformanceReport,
  createCiPerformanceSampleFromEvidence,
  createMaintenancePullRequestManifest,
  createOrdinaryPullRequestManifest,
  findCiPerformanceBudgetViolations,
  MIN_PROMOTION_SAMPLES,
  promoteCiPerformanceBaselines,
  PR_CI_TARGET_MINUTES,
  pullRequestCiDesignBudgetMinutes,
  resolveCacheProvenance,
  selectCiPerformanceHistorySamples,
  turboCacheCounts,
} from "../ci-performance-budget.mts";
import type { CiPerformanceBaseline, CiPerformanceSample } from "../ci-performance-budget.mts";

const ROOT_DIR = resolve(__dirname, "../..");
const WORKFLOW = readFileSync(resolve(ROOT_DIR, ".github/workflows/ci.yml"), "utf8");
const ORDINARY_PR_MANIFEST = createOrdinaryPullRequestManifest();
const MAINTENANCE_PR_MANIFEST = createMaintenancePullRequestManifest();

const AS_OF = new Date("2026-08-10T12:00:00.000Z");

function sample(index: number, overrides: Partial<CiPerformanceSample> = {}): CiPerformanceSample {
  return {
    measurementScope: "validate-job",
    componentConclusion: "success",
    profile: "spine",
    lane: "verification-profile",
    workflowVersion: "ci@v1",
    workflowSchemaVersion: "1",
    runnerOs: "Linux",
    runnerArch: "X64",
    runnerLabel: "ubuntu-latest",
    nodeVersion: "24.1.0",
    pnpmVersion: "10.15.0",
    cacheState: "warm",
    runId: `run-${index.toString().padStart(3, "0")}`,
    jobId: "validate",
    commitSha: `sha-${index}`,
    branch: "trunk",
    timestamp: new Date(AS_OF.getTime() - index * 60_000).toISOString(),
    durationMs: 600_000 + index * 1_000,
    taskCount: 10,
    taskDurationMs: 650_000,
    cacheHitCount: 10,
    cacheMissCount: 0,
    cacheEvidenceComplete: true,
    inventoryDigest: "inventory-v1",
    workflowDigest: "workflow-v1",
    conclusion: "success",
    retryAttempt: 1,
    ...overrides,
  };
}

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

  it("rejects API documentation checks that run for unrelated pull requests", () => {
    const mutant = WORKFLOW.replace(
      "if: needs.changes.outputs.api-source == 'true'",
      "if: needs.changes.outputs.api-source == 'true' || github.event_name == 'pull_request'",
    );

    expect(mutant).not.toBe(WORKFLOW);
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: mutant,
      }),
    ).toContain("generated API documentation drift checks must follow API-source changes");
  });

  it.each([
    [
      "core-verification",
      "  core-verification:\n    needs: changes\n    if: github.event_name == 'workflow_dispatch'",
      "  core-verification:\n    needs: changes",
    ],
    [
      "generated-apps",
      "  generated-apps:\n    needs: changes\n    if: github.event_name == 'workflow_dispatch'",
      "  generated-apps:\n    needs: changes",
    ],
    [
      "package-artifacts",
      "  package-artifacts:\n    needs: changes\n    if: github.event_name == 'workflow_dispatch'",
      "  package-artifacts:\n    needs: changes",
    ],
    [
      "coverage-security",
      "  coverage-security:\n    needs: changes\n    if: github.event_name == 'workflow_dispatch'",
      "  coverage-security:\n    needs: changes",
    ],
    [
      "split-validation-shadow",
      "if: always() && github.event_name == 'workflow_dispatch' && needs.changes.result == 'success'",
      "if: always() && needs.changes.result == 'success'",
    ],
  ] as const)("rejects automatic %s cacheable experiments", (job, marker, replacement) => {
    const mutant = WORKFLOW.replace(marker, replacement);

    expect(mutant).not.toBe(WORKFLOW);
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: mutant,
      }),
    ).toContain(`${job} cacheable CI experiment must stay off automatic change runs`);
  });

  it.each([
    "github.event_name == 'workflow_dispatch' || github.event_name == 'pull_request'",
    "github.event_name == 'workflow_dispatch' || github.event_name == 'push'",
    "github.event_name == 'workflow_dispatch' || true",
  ])("rejects an expanded cacheable experiment condition: %s", (condition) => {
    const mutant = WORKFLOW.replace(
      "if: github.event_name == 'workflow_dispatch'",
      `if: ${condition}`,
    );

    expect(mutant).not.toBe(WORKFLOW);
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: mutant,
      }),
    ).toContain("core-verification cacheable CI experiment must stay off automatic change runs");
  });

  it.each([
    [
      "comment",
      "if: github.event_name == 'pull_request' # github.event_name == 'workflow_dispatch'",
      undefined,
    ],
    [
      "step",
      "if: github.event_name == 'pull_request'",
      "      - name: Resolve cacheable experiment identity\n        if: github.event_name == 'workflow_dispatch'\n        id: split_identity",
    ],
  ] as const)("rejects a manual-only marker confined to a %s", (_location, jobIf, step) => {
    let mutant = WORKFLOW.replace("if: github.event_name == 'workflow_dispatch'", jobIf);
    if (step) {
      mutant = mutant.replace(
        "      - name: Resolve cacheable experiment identity\n        id: split_identity",
        step,
      );
    }

    expect(mutant).not.toBe(WORKFLOW);
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: mutant,
      }),
    ).toContain("core-verification cacheable CI experiment must stay off automatic change runs");
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

  it.each(["typecheck"] as const)("rejects build overlap in the %s evidence phase", (phase) => {
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
  });

  it.each([
    ["build", "typecheck"],
    ["typecheck", "build"],
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

  it("rejects a non-fast authoritative test lane", () => {
    const manifest = ORDINARY_PR_MANIFEST.map((command) =>
      command.id === "test"
        ? {
            ...command,
            command: command.command.map((part) => (part === "fast" ? "integration" : part)),
          }
        : command,
    );
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: manifest,
        workflow: WORKFLOW,
      }),
    ).toContain("test evidence must run only test");
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
    const mutant = WORKFLOW.replace('args+=(--base "$VERIFICATION_BASE" --head HEAD)', "");

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

  it("rejects missing observed evidence or 90-day retention", () => {
    const mutant = WORKFLOW.replace(
      "--sample-output ci-reports/ci-performance/raw-sample.json",
      "--sample-output /tmp/raw-sample.json",
    ).replace("retention-days: 90", "retention-days: 1");
    const violations = findCiPerformanceBudgetViolations({
      maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
      ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
      workflow: mutant,
    });

    expect(violations).toContain(
      "CI must materialize raw and rendered observed performance evidence",
    );
    expect(violations).toContain(
      "CI performance enforcement must retain its raw evidence for 90 days",
    );
  });

  it("rejects partial timing and performance evaluation before post-spine work", () => {
    const partialTiming = WORKFLOW.replace(/\s+--measurement-started-at[^\n]+/, "");
    const missingOutcome = WORKFLOW.replace(/\s+--conclusion[^\n]+/, "");
    const recordMarker = "      - name: Record observed CI performance budget\n";
    const verificationMarker = "      - name: Run selected verification profile\n";
    const reordered = WORKFLOW.replace(recordMarker, "").replace(
      verificationMarker,
      `${recordMarker}${verificationMarker}`,
    );
    const missingRecordMarker = WORKFLOW.replace(recordMarker, "");
    const missingCoverageMarker = WORKFLOW.replace(
      "      - name: Publish core coverage warning summary\n",
      "",
    );

    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: partialTiming,
      }),
    ).toContain(
      "CI performance evidence must cover the explicit validate-job boundary and outcome",
    );
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: missingOutcome,
      }),
    ).toContain(
      "CI performance evidence must cover the explicit validate-job boundary and outcome",
    );
    expect(
      findCiPerformanceBudgetViolations({
        maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
        ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
        workflow: reordered,
      }),
    ).toContain("CI performance evidence must run after post-spine validation work");
    for (const workflow of [missingRecordMarker, missingCoverageMarker]) {
      expect(
        findCiPerformanceBudgetViolations({
          maintenancePullRequestManifest: MAINTENANCE_PR_MANIFEST,
          ordinaryPullRequestManifest: ORDINARY_PR_MANIFEST,
          workflow,
        }),
      ).toContain("CI performance evidence must run after post-spine validation work");
    }
  });
});

describe("observed CI performance budgets", () => {
  it("uses median, MAD, scaled MAD, nearest-rank P95, and the normative threshold", () => {
    const statistics = calculateCiPerformanceStatistics(
      [100, 110, 120, 130, 1_000].map((durationMs) => ({ durationMs })),
    );

    expect(statistics.medianMs).toBe(120);
    expect(statistics.madMs).toBe(10);
    expect(statistics.scaledMadMs).toBeCloseTo(14.826);
    expect(statistics.p95Ms).toBe(1_000);
    expect(statistics.thresholdMs).toBeCloseTo(1_100);
  });

  it("partitions every provenance dimension independently", () => {
    const original = sample(1);
    const fields = [
      ["profile", "publish"],
      ["lane", "published"],
      ["workflowVersion", "ci@v2"],
      ["workflowSchemaVersion", "2"],
      ["runnerOs", "Windows"],
      ["runnerArch", "ARM64"],
      ["runnerLabel", "self-hosted"],
      ["nodeVersion", "26"],
      ["pnpmVersion", "11"],
      ["cacheState", "partial"],
    ] as const;

    for (const [field, value] of fields) {
      const changed = { ...ciPerformancePartition(original), [field]: value };
      expect(ciPerformancePartitionKey(changed), field).not.toBe(
        ciPerformancePartitionKey(original),
      );
    }
  });

  it("selects only the newest 60 successful first-attempt trunk samples from 45 days", () => {
    const eligible = Array.from({ length: 65 }, (_, index) => sample(index));
    const excluded = [
      sample(100, { branch: "feature" }),
      sample(101, { conclusion: "failure" }),
      sample(102, { retryAttempt: 2 }),
      sample(103, { timestamp: "2026-06-01T00:00:00.000Z" }),
    ];
    const candidate = createCiPerformanceBaselineCandidate(
      [...eligible, ...excluded],
      ciPerformancePartition(eligible[0]),
      AS_OF,
    );

    expect(candidate.samples).toHaveLength(60);
    expect(candidate.samples[0].runId).toBe("run-000");
    expect(candidate.samples.at(-1)?.runId).toBe("run-059");
  });

  it("does not let duplicate run artifacts inflate the promotion population", () => {
    const duplicated = Array.from({ length: MIN_PROMOTION_SAMPLES }, () => sample(0));
    const candidate = createCiPerformanceBaselineCandidate(
      duplicated,
      ciPerformancePartition(duplicated[0]),
      AS_OF,
    );

    expect(candidate.samples).toHaveLength(1);
    expect(candidate.diagnostics.map(({ code }) => code)).toContain("BUDGET_NOT_ENFORCEABLE");
  });

  it("suspends promotion for too few, incomplete, or unstable samples", () => {
    const tooFew = createCiPerformanceBaselineCandidate(
      Array.from({ length: MIN_PROMOTION_SAMPLES - 1 }, (_, index) => sample(index)),
      ciPerformancePartition(sample(0)),
      AS_OF,
    );
    const incompleteSamples = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) =>
      sample(index, index === 0 ? { pnpmVersion: "" } : {}),
    );
    const incomplete = createCiPerformanceBaselineCandidate(
      incompleteSamples,
      ciPerformancePartition(incompleteSamples[0]),
      AS_OF,
    );
    const unstableSamples = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) =>
      sample(index, { durationMs: index % 2 === 0 ? 100 : 1_000 }),
    );
    const unstable = createCiPerformanceBaselineCandidate(
      unstableSamples,
      ciPerformancePartition(unstableSamples[0]),
      AS_OF,
    );

    expect(tooFew.diagnostics.map(({ code }) => code)).toContain("BUDGET_NOT_ENFORCEABLE");
    expect(incomplete.diagnostics.map(({ message }) => message)).toContain(
      "partition contains incomplete sample provenance",
    );
    expect(unstable.statistics?.variability).toBeGreaterThan(0.2);
    expect(unstable.diagnostics.map(({ code }) => code)).toContain("BUDGET_NOT_ENFORCEABLE");
  });

  it("requires explicit review before promoting a baseline", () => {
    const samples = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) => sample(index));

    expect(() =>
      promoteCiPerformanceBaselines({
        samples,
        existing: [],
        asOf: AS_OF,
        reviewed: false,
        reviewedBy: "",
      }),
    ).toThrow("explicit --reviewed approval");
    expect(
      promoteCiPerformanceBaselines({
        samples,
        existing: [],
        asOf: AS_OF,
        reviewed: true,
        reviewedBy: "release-engineering",
      }).baselines,
    ).toHaveLength(1);
  });

  it("passes equality and fails only above a matching reviewed threshold", () => {
    const samples = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) => sample(index));
    const promoted = promoteCiPerformanceBaselines({
      samples,
      existing: [],
      asOf: AS_OF,
      reviewed: true,
      reviewedBy: "release-engineering",
    }).baselines[0];
    const threshold = promoted.statistics.thresholdMs;
    const equal = sample(200, { durationMs: threshold, timestamp: AS_OF.toISOString() });
    const exceeded = sample(201, { durationMs: threshold + 1, timestamp: AS_OF.toISOString() });

    expect(
      createCiPerformanceReport({
        samples,
        currentSamples: [equal],
        baselines: [promoted],
        asOf: AS_OF,
        enforce: true,
      }).failed,
    ).toBe(false);
    expect(
      createCiPerformanceReport({
        samples,
        currentSamples: [exceeded],
        baselines: [promoted],
        asOf: AS_OF,
        enforce: true,
      }).diagnostics.map(({ code }) => code),
    ).toContain("CI_DURATION_BUDGET_EXCEEDED");
  });

  it("keeps missing and unreviewed baselines report-only", () => {
    const current = sample(0, { timestamp: AS_OF.toISOString() });
    const unreviewed: CiPerformanceBaseline = {
      key: ciPerformancePartitionKey(current),
      partition: ciPerformancePartition(current),
      inventoryDigest: current.inventoryDigest,
      workflowDigest: current.workflowDigest,
      reviewed: false,
      reviewedBy: "",
      reviewedAt: "",
      promotedAt: "",
      sampleExecutionIds: [],
      statistics: calculateCiPerformanceStatistics([current]),
    };

    for (const baselines of [[], [unreviewed]]) {
      const report = createCiPerformanceReport({
        samples: [current],
        currentSamples: [current],
        baselines,
        asOf: AS_OF,
        enforce: true,
      });
      expect(report.failed).toBe(false);
      expect(report.diagnostics.map(({ code }) => code)).toContain("BUDGET_NOT_ENFORCEABLE");
    }
  });

  it("materializes a raw sample with run, runner, toolchain, cache, and digest provenance", () => {
    const created = createCiPerformanceSampleFromEvidence({
      evidence: {
        schemaVersion: 1,
        profile: "spine",
        generatedAt: "2026-08-10T11:50:00.000Z",
        completedAt: AS_OF.toISOString(),
        status: "passed",
        provenance: { commitSha: "abc", runAttempt: "1", runId: "42" },
        checks: [{ durationMs: 400_000 }, { durationMs: 300_000 }],
      },
      conclusion: "success",
      measurementStartedAt: "2026-08-10T11:45:00.000Z",
      measurementCompletedAt: "2026-08-10T12:05:00.000Z",
      branch: "trunk",
      jobId: "validate",
      runnerOs: "Linux",
      runnerArch: "ARM64",
      runnerLabel: "ubuntu-latest",
      nodeVersion: "24",
      pnpmVersion: "10",
      inventoryDigest: "inventory",
      workflowDigest: "workflow",
      workflowVersion: "ci@abc",
      cacheHitCount: 7,
      cacheMissCount: 3,
      cacheState: "partial",
      cacheEvidenceComplete: true,
      injectedFailure: "generated-apps",
    });

    expect(created).toMatchObject({
      runId: "42",
      commitSha: "abc",
      retryAttempt: 1,
      durationMs: 1_200_000,
      taskCount: 10,
      taskDurationMs: 700_000,
      cacheHitCount: 7,
      cacheMissCount: 3,
      inventoryDigest: "inventory",
      workflowDigest: "workflow",
      cacheEvidenceComplete: true,
      injectedFailure: "generated-apps",
    });
  });

  it("refuses to promote or pass a partial verification-only timing sample", () => {
    const partial = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) => {
      const current = sample(index);
      return { ...current, measurementScope: undefined } as unknown as CiPerformanceSample;
    });
    const candidate = createCiPerformanceBaselineCandidate(
      partial,
      ciPerformancePartition(partial[0]),
      AS_OF,
    );
    expect(candidate.diagnostics.map(({ message }) => message)).toContain(
      "partition contains incomplete sample provenance",
    );

    const complete = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) => sample(index));
    const baseline = promoteCiPerformanceBaselines({
      samples: complete,
      existing: [],
      asOf: AS_OF,
      reviewed: true,
      reviewedBy: "release-engineering",
    }).baselines[0];
    const report = createCiPerformanceReport({
      samples: complete,
      currentSamples: [partial[0]],
      baselines: [baseline],
      asOf: AS_OF,
      enforce: true,
    });
    expect(report.failed).toBe(true);
    expect(report.diagnostics.map(({ code }) => code)).toContain("CI_MEASUREMENT_INCOMPLETE");
    expect(report.diagnostics.map(({ code }) => code)).not.toContain("CI_DURATION_BUDGET_PASSED");
  });

  it("excludes a passed spine when a later validate step fails", () => {
    const laterFailures = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) =>
      sample(index, { componentConclusion: "success", conclusion: "failure" }),
    );
    expect(
      selectCiPerformanceHistorySamples([
        sample(100),
        laterFailures[0],
        sample(101, { retryAttempt: 2 }),
        sample(102, { branch: "feature" }),
      ]).map(({ runId }) => runId),
    ).toEqual(["run-100"]);
    const candidate = createCiPerformanceBaselineCandidate(
      laterFailures,
      ciPerformancePartition(laterFailures[0]),
      AS_OF,
    );
    expect(candidate.samples).toEqual([]);
    expect(candidate.diagnostics.map(({ code }) => code)).toContain("BUDGET_NOT_ENFORCEABLE");

    const successful = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) => sample(index));
    const baseline = promoteCiPerformanceBaselines({
      samples: successful,
      existing: [],
      asOf: AS_OF,
      reviewed: true,
      reviewedBy: "release-engineering",
    }).baselines[0];
    const report = createCiPerformanceReport({
      samples: successful,
      currentSamples: [laterFailures[0]],
      baselines: [baseline],
      asOf: AS_OF,
      enforce: true,
    });
    expect(report.failed).toBe(true);
    expect(report.diagnostics.map(({ code }) => code)).toContain("CI_JOB_NOT_SUCCESSFUL");
    expect(report.diagnostics.map(({ code }) => code)).not.toContain("CI_DURATION_BUDGET_PASSED");
  });

  it("rejects a validate-job boundary that covers only part of verification", () => {
    expect(() =>
      createCiPerformanceSampleFromEvidence({
        evidence: {
          schemaVersion: 1,
          profile: "spine",
          generatedAt: "2026-08-10T11:50:00.000Z",
          completedAt: AS_OF.toISOString(),
          status: "passed",
          provenance: { commitSha: "abc", runAttempt: "1", runId: "42" },
          checks: [{ durationMs: 400_000 }],
        },
        conclusion: "success",
        measurementStartedAt: "2026-08-10T11:55:00.000Z",
        measurementCompletedAt: "2026-08-10T12:05:00.000Z",
        branch: "trunk",
        jobId: "validate",
        runnerOs: "Linux",
        runnerArch: "ARM64",
        runnerLabel: "ubuntu-latest",
        nodeVersion: "24",
        pnpmVersion: "10",
        inventoryDigest: "inventory",
        workflowDigest: "workflow",
        workflowVersion: "ci@abc",
        cacheHitCount: 1,
        cacheMissCount: 0,
        cacheState: "warm",
      }),
    ).toThrow("must contain the completed verification evidence interval");
  });

  it("keeps samples without structured Turbo cache evidence out of promotion", () => {
    const incomplete = Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) =>
      sample(index, { cacheEvidenceComplete: false }),
    );
    const candidate = createCiPerformanceBaselineCandidate(
      incomplete,
      ciPerformancePartition(incomplete[0]),
      AS_OF,
    );

    expect(candidate.diagnostics.map(({ code }) => code)).toContain("BUDGET_NOT_ENFORCEABLE");
  });

  it("preserves the observed task count so impossible cache hits fail provenance", () => {
    expect(
      turboCacheCounts({
        schemaVersion: 1,
        profile: "spine",
        generatedAt: AS_OF.toISOString(),
        completedAt: AS_OF.toISOString(),
        status: "passed",
        provenance: { commitSha: "abc", runAttempt: "1", runId: "42" },
        checks: [
          {
            durationMs: 1,
            stdoutExcerpt: "Tasks: 1 successful, 1 total\nCached: 2 cached, 1 total",
          },
        ],
      }),
    ).toEqual({ complete: false, hitCount: 2, missCount: 0, taskCount: 1 });

    const forged = sample(0, {
      taskCount: 1,
      cacheHitCount: 2,
      cacheMissCount: 0,
    });
    const candidate = createCiPerformanceBaselineCandidate(
      Array.from({ length: MIN_PROMOTION_SAMPLES }, (_, index) => ({
        ...forged,
        runId: `run-${index}`,
      })),
      ciPerformancePartition(forged),
      AS_OF,
    );

    expect(candidate.diagnostics.map(({ message }) => message)).toContain(
      "partition contains incomplete sample provenance",
    );
  });

  it("fails closed when a Turbo check omits both cache summary markers", () => {
    const observed = turboCacheCounts({
      schemaVersion: 1,
      profile: "spine",
      generatedAt: AS_OF.toISOString(),
      completedAt: AS_OF.toISOString(),
      status: "passed",
      provenance: { commitSha: "abc", runAttempt: "1", runId: "42" },
      checks: [
        {
          command: ["pnpm", "turbo", "run", "build"],
          durationMs: 1,
          stdoutExcerpt: "Tasks: 1 successful, 1 total\nCached: 1 cached, 1 total",
        },
        {
          command: ["pnpm", "turbo", "run", "test"],
          durationMs: 1,
          stdoutExcerpt: "Turbo output was truncated before its summary",
        },
      ],
    });

    expect(observed).toEqual({ complete: false, hitCount: 1, missCount: 0, taskCount: 1 });
  });

  it("does not let explicit cache counts bypass incomplete observed provenance", () => {
    expect(
      resolveCacheProvenance({ complete: false, hitCount: 0, missCount: 0, taskCount: 4 }, 4, 0),
    ).toEqual({ complete: false, taskCount: 4 });
    expect(
      resolveCacheProvenance({ complete: true, hitCount: 3, missCount: 1, taskCount: 4 }, 5, 0),
    ).toEqual({ complete: false, taskCount: 4 });
  });

  it("excludes invalid timestamps from retained performance history", () => {
    expect(
      selectCiPerformanceHistorySamples([
        sample(0),
        sample(1, { runId: "invalid-time", timestamp: "not-a-timestamp" }),
      ]).map(({ runId }) => runId),
    ).toEqual([sample(0).runId]);
  });

  it("selects equal-time samples independently of artifact merge order", () => {
    const equalTime = Array.from({ length: 65 }, (_, index) =>
      sample(index, {
        runId: "same-run",
        jobId: `job-${index.toString().padStart(2, "0")}`,
        timestamp: AS_OF.toISOString(),
      }),
    );
    const partition = ciPerformancePartition(equalTime[0]);
    const forward = createCiPerformanceBaselineCandidate(equalTime, partition, AS_OF);
    const reverse = createCiPerformanceBaselineCandidate(
      [...equalTime].reverse(),
      partition,
      AS_OF,
    );

    expect(forward.samples.map(({ jobId }) => jobId)).toEqual(
      reverse.samples.map(({ jobId }) => jobId),
    );
  });

  it("reports retained and excluded samples deterministically across the 90-day boundary", () => {
    const recent = sample(0, { timestamp: AS_OF.toISOString() });
    const old = sample(1, { timestamp: "2026-04-01T00:00:00.000Z" });
    const report = createCiPerformanceReport({
      samples: [old, recent],
      baselines: [],
      asOf: AS_OF,
    });

    expect(report.partitions[0].retainedSampleCount).toBe(1);
    expect(report.partitions[0].excluded).toContainEqual({
      runId: old.runId,
      reason: "outside-retention",
    });
  });
});
