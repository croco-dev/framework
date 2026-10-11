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
  readonly cancelledPublishSourceRun?: boolean;
  readonly cancelledNonPublishSourceRun?: boolean;
  readonly omitConclusion?: boolean;
  readonly inProgressSourceRun?: boolean;
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
    ...(options.cancelledPublishSourceRun ? [106] : []),
  ];
  const sourceRuns = [
    ...publishRuns.map((id, index) => ({
      id,
      run_attempt: 1,
      created_at: `2026-08-1${3 - index}T00:00:00.000Z`,
      updated_at: `2026-08-1${3 - index}T00:30:00.000Z`,
      status: "completed",
      ...(options.omitConclusion && id === 101
        ? {}
        : { conclusion: id === 106 ? "cancelled" : "success" }),
    })),
    {
      id: 102,
      run_attempt: 1,
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:20:00.000Z",
      status: "completed",
      conclusion: options.cancelledNonPublishSourceRun ? "cancelled" : "success",
    },
    {
      id: 103,
      run_attempt: 1,
      created_at: "2026-08-10T00:00:00.000Z",
      updated_at: "2026-08-10T00:10:00.000Z",
      status: "completed",
      conclusion: "success",
    },
    ...(options.inProgressSourceRun
      ? [
          {
            id: 107,
            run_attempt: 1,
            created_at: "2026-08-12T06:00:00.000Z",
            updated_at: "2026-08-12T06:10:00.000Z",
            status: "in_progress",
            conclusion: null,
          },
        ]
      : []),
  ];
  const paginationRuns = options.truncateSourcePagination
    ? Array.from({ length: 101 }, (_, index) => ({
        id: 1_000 + index,
        run_attempt: 1,
        created_at: "2026-08-09T00:00:00.000Z",
        updated_at: "2026-08-09T00:10:00.000Z",
        status: "completed",
        conclusion: "success",
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
                  conclusion: "success",
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

  it("classifies a cancelled publish source run as an operational source with the fixed reason", () => {
    const dataset = collectCacheableCiDataset(fixture({ cancelledPublishSourceRun: true }), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });

    expect(dataset.inventory.operationalSources).toContainEqual(
      expect.objectContaining({ sourceRunId: "106", reason: "source-run-cancelled" }),
    );
    expect(dataset.inventory.excludedSources).not.toContainEqual(
      expect.objectContaining({ sourceRunId: "106" }),
    );
    const queries = dataset.inventory.pages.map(({ query }) => query);
    expect(queries).toContain("source-artifacts:106");
    expect(queries).not.toContain("source-jobs:106");
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });

  it("keeps a cancelled non-publish source run in the profile exclusion", () => {
    const dataset = collectCacheableCiDataset(fixture({ cancelledNonPublishSourceRun: true }), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });

    expect(dataset.inventory.excludedSources).toContainEqual(
      expect.objectContaining({ sourceRunId: "102", reason: "profile:spine" }),
    );
    expect(dataset.inventory.operationalSources).not.toContainEqual(
      expect.objectContaining({ sourceRunId: "102" }),
    );
  });

  it("classifies non-cancelled runs as eligible, profile-excluded, or missing-artifact operational sources", () => {
    const dataset = collectCacheableCiDataset(fixture(), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });

    expect(dataset.inventory.operationalSources).toEqual([
      expect.objectContaining({
        sourceRunId: "103",
        reason: "source-performance-artifact-missing",
      }),
    ]);
    expect(dataset.inventory.excludedSources).toEqual([
      expect.objectContaining({ sourceRunId: "102", reason: "profile:spine" }),
    ]);
    expect(dataset.observations.map(({ sourceRunId }) => sourceRunId)).toEqual(["101"]);
  });

  it("accepts a null conclusion on an in-progress source run and records it as not completed", () => {
    const dataset = collectCacheableCiDataset(fixture({ inProgressSourceRun: true }), {
      cutoffAt: CUTOFF,
      cohortStartedAt: COHORT_STARTED_AT,
    });

    expect(dataset.inventory.operationalSources).toContainEqual(
      expect.objectContaining({ sourceRunId: "107", reason: "source-run-not-completed-at-cutoff" }),
    );
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });

  it("fails parsing when a source run is missing the conclusion key", () => {
    expect(() =>
      collectCacheableCiDataset(fixture({ omitConclusion: true }), {
        cutoffAt: CUTOFF,
        cohortStartedAt: COHORT_STARTED_AT,
      }),
    ).toThrow(/conclusion must be a string or null/);
  });
});

type ListedRun = {
  id: number;
  run_attempt: number;
  created_at: string;
  updated_at: string;
  status: string;
  conclusion: string;
};

function listedRun(id: number, createdAt: string): ListedRun {
  return {
    id,
    run_attempt: 1,
    created_at: createdAt,
    updated_at: createdAt,
    status: "completed",
    conclusion: "success",
  };
}

function cappedRepository(sourceCount: number, observerCount = 1) {
  const queries: { workflow: string; page: number; range: string }[] = [];
  const earlierRuns = (count: number, offset: number) =>
    Array.from({ length: count }, (_, index) =>
      listedRun(
        offset + index,
        new Date(Date.parse("2026-06-01T00:00:00Z") + index * 3_600_000).toISOString(),
      ),
    );
  const sourceRuns = [
    listedRun(101, "2026-08-13T00:00:00.000Z"),
    ...earlierRuns(sourceCount - 1, 10_000),
  ];
  const observerRuns = [
    listedRun(900, "2026-08-13T00:31:00Z"),
    ...earlierRuns(observerCount - 1, 20_000),
  ];
  const base = fixture();
  const client: CacheableCiCollectionClient = {
    ...base,
    listWorkflowRuns: (workflow, page, range) => {
      queries.push({ workflow, page, range });
      const [from = "", to = ""] = range.split("..");
      const matches = (workflow === "ci.yml" ? sourceRuns : observerRuns)
        .filter(
          (run) =>
            Date.parse(run.created_at) >= Date.parse(from) &&
            Date.parse(run.created_at) <= Date.parse(to),
        )
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      return page > 10
        ? { total_count: 0, workflow_runs: [] }
        : {
            total_count: matches.length,
            workflow_runs: matches.slice((page - 1) * 100, page * 100),
          };
    },
  };
  return { client, queries, sourceRuns, observerRuns };
}

const collectionOptions = { cutoffAt: CUTOFF, cohortStartedAt: COHORT_STARTED_AT };

describe("cacheable CI observation collector listing limits", () => {
  it.each([900, 999, 1000, 1050])("collects all %i sources under the filtered API cap", (count) => {
    const { client, queries } = cappedRepository(count);
    const dataset = collectCacheableCiDataset(client, collectionOptions);
    expect(dataset.inventory.sourceRunCount).toBe(count);
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
    expect(queries.every(({ page }) => page <= 10)).toBe(true);
    if (count >= 1000) {
      expect(
        new Set(queries.filter(({ workflow }) => workflow === "ci.yml").map(({ range }) => range))
          .size,
      ).toBeGreaterThan(1);
      expect(
        dataset.inventory.pages.some(({ query }) => query.startsWith("source-runs:created=")),
      ).toBe(true);
    }
  });

  it("collects observer artifacts beyond the newest 1000 runs", () => {
    const { client, observerRuns } = cappedRepository(1, 1050);
    observerRuns[0] = listedRun(900, "2026-05-17T00:00:00Z");
    const dataset = collectCacheableCiDataset(client, collectionOptions);
    expect(dataset.observations).toHaveLength(1);
    expect(
      dataset.inventory.pages.filter(({ query }) => query.startsWith("observer-artifacts:")),
    ).toHaveLength(1050);
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });

  it.each([0, 100, 102])("rejects a later total_count changing to %i", (total) => {
    const base = fixture({ truncateSourcePagination: true });
    const client = {
      ...base,
      listWorkflowRuns: (workflow: string, page: number, range: string) => {
        const response = base.listWorkflowRuns(workflow, page, range);
        return workflow === "ci.yml" && page > 1 ? { ...response, total_count: total } : response;
      },
    };
    expect(() => collectCacheableCiDataset(client, collectionOptions)).toThrow(
      /total_count changed/,
    );
  });

  it("fails when a single second remains saturated", () => {
    const { client, sourceRuns } = cappedRepository(1001);
    sourceRuns.forEach((run) => {
      run.created_at = "2026-06-01T00:00:00Z";
    });
    expect(() => collectCacheableCiDataset(client, collectionOptions)).toThrow(
      /cannot subdivide.*1000/,
    );
  });

  it("preserves inclusive subdivision seconds and excludes timestamps outside a fractional window", () => {
    const { client, sourceRuns, queries } = cappedRepository(1050);
    const cutoff = Date.parse(CUTOFF) + 500;
    const start = cutoff - 90 * 24 * 60 * 60_000;
    const lower = Math.ceil(start / 1000);
    const upper = Math.floor(cutoff / 1000);
    const midpoint = Math.floor((lower + upper) / 2);
    [lower, midpoint, midpoint, midpoint + 1, midpoint + 1, upper, lower - 1, upper + 1].forEach(
      (second, index) => {
        sourceRuns[index + 1] = listedRun(30_000 + index, new Date(second * 1000).toISOString());
      },
    );
    const dataset = collectCacheableCiDataset(client, {
      ...collectionOptions,
      cutoffAt: new Date(cutoff).toISOString(),
    });
    expect(dataset.inventory.sourceRunCount).toBe(1048);
    const accounted = [
      ...dataset.inventory.sources,
      ...dataset.inventory.excludedSources,
      ...dataset.inventory.operationalSources,
    ].map(({ sourceRunId }) => sourceRunId);
    expect(accounted).toEqual(
      expect.arrayContaining(["30000", "30001", "30002", "30003", "30004", "30005"]),
    );
    expect(accounted).not.toContain("30006");
    expect(accounted).not.toContain("30007");
    expect(queries).toContainEqual({
      workflow: "ci.yml",
      page: 1,
      range: `${new Date(lower * 1000).toISOString()}..${new Date(midpoint * 1000).toISOString()}`,
    });
    expect(queries).toContainEqual({
      workflow: "ci.yml",
      page: 1,
      range: `${new Date((midpoint + 1) * 1000).toISOString()}..${new Date(upper * 1000).toISOString()}`,
    });
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
    const groups = Map.groupBy(
      dataset.inventory.pages.filter(({ query }) => query.startsWith("source-runs:")),
      ({ query }) => query,
    );
    for (const pages of groups.values()) {
      expect(pages.reduce((sum, { itemCount }) => sum + itemCount, 0)).toBe(pages[0]?.totalCount);
      expect(pages.at(-1)?.nextCursor).toBeNull();
      expect(pages.at(-1)?.itemCount).toBeLessThan(100);
    }
  });

  it("rejects repeated run IDs that conceal missing runs in a leaf", () => {
    const { client } = cappedRepository(150);
    const duplicateClient = {
      ...client,
      listWorkflowRuns: (workflow: string, page: number, range: string) => {
        const response = client.listWorkflowRuns(workflow, page, range);
        return workflow === "ci.yml" && page === 2
          ? {
              ...response,
              workflow_runs: client
                .listWorkflowRuns(workflow, 1, range)
                .workflow_runs?.slice(0, 50),
            }
          : response;
      },
    };
    expect(() => collectCacheableCiDataset(duplicateClient, collectionOptions)).toThrow(
      /unique run count does not equal total_count/,
    );
  });

  it("deduplicates run IDs across independently collected ranges", () => {
    const { client, sourceRuns } = cappedRepository(1050);
    sourceRuns[1] = listedRun(77_777, "2026-06-01T00:00:00Z");
    sourceRuns[2] = listedRun(77_777, "2026-08-01T00:00:00Z");
    const dataset = collectCacheableCiDataset(client, collectionOptions);
    expect(dataset.inventory.sourceRunCount).toBe(1049);
    expect(
      dataset.inventory.pages
        .flatMap(({ sourceRunIds }) => sourceRunIds)
        .filter((id) => id === "77777"),
    ).toHaveLength(1);
    expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(false);
  });

  it("rejects counts that increase even after all originally declared items were received", () => {
    const { client } = cappedRepository(100);
    const changedClient = {
      ...client,
      listWorkflowRuns: (workflow: string, page: number, range: string) => {
        const response = client.listWorkflowRuns(workflow, page, range);
        return workflow === "ci.yml" && page === 2 ? { ...response, total_count: 101 } : response;
      },
    };
    expect(() => collectCacheableCiDataset(changedClient, collectionOptions)).toThrow(
      /total_count changed from 100 to 101/,
    );
  });
});
