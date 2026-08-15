import { describe, expect, it } from "vitest";

import {
  collectCacheableCiDataset,
  type CacheableCiCollectionClient,
} from "../ci-cacheable-lanes-collector.mts";
import {
  evaluateDataset,
  LANE_OWNERSHIP,
  OBSERVATION_SCHEMA,
  SECURITY_OWNERSHIP,
  type Observation,
  type ResultRecord,
} from "../ci-cacheable-lanes-evaluator.mts";

const DIGEST = "a".repeat(64);
const SHA = "b".repeat(40);
const CUTOFF = "2026-08-14T00:00:00.000Z";
const COHORT_STARTED_AT = "2026-08-10T00:00:00.000Z";

type FixtureOptions = {
  readonly includeMissingObserverSource?: boolean;
  readonly includeLegacyMismatchedObserver?: boolean;
  readonly duplicateObserverArtifact?: boolean;
  readonly truncateSourcePagination?: boolean;
};

function manifestResults(): readonly ResultRecord[] {
  return Object.values(LANE_OWNERSHIP)
    .flat()
    .map((id) => ({
      id,
      conclusion: "success",
      semantics: id === "core-coverage-warning" ? "advisory" : "blocking",
      diagnostics: [],
    }));
}

function securityResults(): readonly ResultRecord[] {
  return SECURITY_OWNERSHIP.map(({ id, semantics }) => ({
    id,
    conclusion: "success",
    semantics: semantics === "blocking" ? "blocking" : "advisory",
    diagnostics: [],
  }));
}

function observation(runId: number): Observation {
  return {
    schemaVersion: OBSERVATION_SCHEMA,
    sourceRunId: String(runId),
    sourceAttempt: 1,
    sourceCreatedAt: "2026-08-13T00:00:00.000Z",
    sourceCompletedAt: "2026-08-13T00:30:00.000Z",
    sourceSha: SHA,
    architectureVersion: "monolithic",
    jobIdentity: "validate",
    lane: "monolithic",
    artifactName: `ci-observation-${runId}-1`,
    startedAt: "2026-08-13T00:01:00.000Z",
    completedAt: "2026-08-13T00:29:00.000Z",
    conclusion: "success",
    blockingOutcome: "success",
    operationalFailure: false,
    profile: "publish",
    runnerOs: "Linux",
    runnerArch: "X64",
    runnerLabel: "ubuntu-latest",
    nodeVersion: "24.5.0",
    pnpmVersion: "10.15.0",
    turboVersion: "2.10.2",
    toolchainDigest: DIGEST,
    manifestDigest: DIGEST,
    inventoryDigest: DIGEST,
    inputDigest: DIGEST,
    verificationExperimentId: `experiment-${runId}`,
    evidenceDigest: DIGEST,
    injectedFailure: "none",
    cacheEligibleTaskIds: ["repo:ci#test"],
    validCacheHitTaskIds: [],
    freshAttestation: true,
    checkResults: manifestResults(),
    securityResults: securityResults(),
    stableDiagnostics: [],
  };
}

function performance(profile: string): unknown {
  return {
    schemaVersion: "croco.ci-performance-samples/v1",
    currentSamples: [{ profile }],
  };
}

function performanceHistory(): unknown {
  return {
    schemaVersion: "croco.ci-performance-samples/v1",
    samples: [],
  };
}

function fixture(options: FixtureOptions = {}): CacheableCiCollectionClient {
  const publishRuns = [
    101,
    ...(options.includeMissingObserverSource ? [104] : []),
    ...(options.includeLegacyMismatchedObserver ? [105] : []),
  ];
  const sourceRuns = [
    ...publishRuns.map((id, index) => ({
      id,
      run_attempt: 1,
      created_at: `2026-08-1${3 - index}T00:00:00.000Z`,
      updated_at: `2026-08-1${3 - index}T00:30:00.000Z`,
      status: "completed",
    })),
    {
      id: 102,
      run_attempt: 1,
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:20:00.000Z",
      status: "completed",
    },
    {
      id: 103,
      run_attempt: 1,
      created_at: "2026-08-10T00:00:00.000Z",
      updated_at: "2026-08-10T00:10:00.000Z",
      status: "completed",
    },
  ];
  const paginationRuns = options.truncateSourcePagination
    ? Array.from({ length: 101 }, (_, index) => ({
        id: 1_000 + index,
        run_attempt: 1,
        created_at: "2026-08-09T00:00:00.000Z",
        updated_at: "2026-08-09T00:10:00.000Z",
        status: "completed",
      }))
    : sourceRuns;
  const observerArtifacts = [
    { name: "ci-observation-101-1", expired: false },
    ...(options.includeLegacyMismatchedObserver
      ? [{ name: "ci-observation-105-1", expired: false }]
      : []),
    ...(options.duplicateObserverArtifact
      ? [{ name: "ci-observation-101-1", expired: false }]
      : []),
  ];
  return {
    listWorkflowRuns: (workflow, page) => {
      if (workflow === "ci.yml") {
        const items = options.truncateSourcePagination
          ? page === 1
            ? paginationRuns.slice(0, 100)
            : []
          : page === 1
            ? paginationRuns
            : [];
        return { total_count: paginationRuns.length, workflow_runs: items };
      }
      return {
        total_count: 1,
        workflow_runs:
          page === 1
            ? [
                {
                  id: 900,
                  run_attempt: 1,
                  created_at: "2026-08-13T00:31:00.000Z",
                  updated_at: "2026-08-13T00:32:00.000Z",
                  status: "completed",
                },
              ]
            : [],
      };
    },
    listRunArtifacts: (runId, page) => {
      if (page !== 1) return { total_count: 0, artifacts: [] };
      if (runId === 900)
        return { total_count: observerArtifacts.length, artifacts: observerArtifacts };
      if (publishRuns.includes(runId))
        return {
          total_count: 1,
          artifacts: [{ name: `ci-performance-${runId}-1`, expired: false }],
        };
      if (runId === 102)
        return {
          total_count: 3,
          artifacts: [
            { name: "ci-performance-102-1", expired: false },
            { name: "package-quality-dashboard", expired: false },
            { name: "package-quality-dashboard", expired: false },
          ],
        };
      return { total_count: 0, artifacts: [] };
    },
    listRunJobs: (_runId, page) => ({
      total_count: 1,
      jobs: page === 1 ? [{ name: "validate" }] : [],
    }),
    readArtifactJson: (runId, artifactName) => {
      if (runId === 900 && artifactName === "ci-observation-101-1") return [observation(101)];
      if (runId === 900 && artifactName === "ci-observation-105-1")
        return [{ ...observation(105), jobIdentity: "unexpected-job" }];
      if (artifactName.startsWith("ci-performance-"))
        return [performanceHistory(), performance(runId === 102 ? "spine" : "publish")];
      return [];
    },
  };
}

describe("cacheable CI observation collector", () => {
  it("selects the current sample beside history and produces a contract-valid dataset", () => {
    const dataset = collectCacheableCiDataset(fixture(), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });

    expect(dataset.inventory.sourceRunCount).toBe(3);
    expect(dataset.inventory.eligibleSourceCount).toBe(1);
    expect(dataset.inventory.excludedSources).toEqual([
      expect.objectContaining({ sourceRunId: "102", reason: "profile:spine" }),
    ]);
    expect(dataset.inventory.operationalSources).toEqual([
      expect.objectContaining({
        sourceRunId: "103",
        reason: "source-performance-artifact-missing",
      }),
    ]);
    expect(dataset.inventory.pages.map(({ query }) => query)).toContain("source-runs");
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });

  it("fails closed when GitHub pagination ends before total_count", () => {
    expect(() =>
      collectCacheableCiDataset(fixture({ truncateSourcePagination: true }), {
        cutoffAt: CUTOFF,
        cohortStartedAt: COHORT_STARTED_AT,
      }),
    ).toThrow(/pagination ended before total_count/);
  });

  it("makes a missing observer artifact an evaluator-blocking omission", () => {
    const dataset = collectCacheableCiDataset(fixture({ includeMissingObserverSource: true }), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });
    const report = evaluateDataset(dataset, { contractOnly: true });

    expect(report.failed).toBe(true);
    expect(report.diagnostics[0]?.message).toMatch(
      /source artifacts must equal paginated artifacts|missing expected observation/,
    );
  });

  it("accounts incompatible pre-cohort observer records without counting them", () => {
    const dataset = collectCacheableCiDataset(fixture({ includeLegacyMismatchedObserver: true }), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });

    expect(dataset.inventory.eligibleSourceCount).toBe(1);
    expect(dataset.inventory.operationalSources).toContainEqual(
      expect.objectContaining({ sourceRunId: "105", reason: "observer-record-set-mismatch" }),
    );
    expect(dataset.observations.map(({ sourceRunId }) => sourceRunId)).toEqual(["101"]);
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });

  it("rejects duplicate immutable observer artifacts", () => {
    expect(() =>
      collectCacheableCiDataset(fixture({ duplicateObserverArtifact: true }), {
        cutoffAt: CUTOFF,
        cohortStartedAt: COHORT_STARTED_AT,
      }),
    ).toThrow(/must be unique/);
  });

  it("excludes sources before the trusted cohort start before inspecting artifacts", () => {
    const cohortStartedAt = "2026-08-12T12:00:00.000Z";
    const dataset = collectCacheableCiDataset(fixture(), {
      cutoffAt: CUTOFF,
      cohortStartedAt,
    });

    expect(dataset.inventory.cohortStartedAt).toBe(cohortStartedAt);
    expect(dataset.inventory.eligibleSourceCount).toBe(1);
    expect(dataset.inventory.excludedSources).toEqual([
      expect.objectContaining({ sourceRunId: "102", reason: `before-cohort:${cohortStartedAt}` }),
      expect.objectContaining({ sourceRunId: "103", reason: `before-cohort:${cohortStartedAt}` }),
    ]);
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });
});
