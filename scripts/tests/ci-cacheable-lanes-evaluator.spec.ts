import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import {
  DATASET_SCHEMA,
  evaluateDataset,
  INVENTORY_SCHEMA,
  LANE_OWNERSHIP,
  nearestRankP95,
  OBSERVATION_SCHEMA,
  observationKey,
  parseObservation,
  SECURITY_OWNERSHIP,
} from "../ci-cacheable-lanes-evaluator.mts";
import {
  injectedFailureCommandId,
  injectedFailureDiagnostic,
} from "../ci-cacheable-failure-injection.mts";
import type {
  Dataset,
  Observation,
  OwnershipRecord,
  ResultRecord,
} from "../ci-cacheable-lanes-evaluator.mts";

const DIGEST = "a".repeat(64);
const SHA = "b".repeat(40);
const CUTOFF = "2026-08-14T00:00:00.000Z";
const WINDOW_START = "2026-05-16T00:00:00.000Z";
const DIRECTORIES: string[] = [];

afterEach(() => {
  for (const directory of DIRECTORIES.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const manifestOwnership: OwnershipRecord[] = Object.entries(LANE_OWNERSHIP).flatMap(
  ([owner, ids]) =>
    ids.map((id) => ({
      id,
      owner,
      semantics: id === "core-coverage-warning" ? "advisory" : "blocking",
    })),
);

function checkResults(
  owner?: keyof typeof LANE_OWNERSHIP,
  failureClass?: Observation["injectedFailure"],
): ResultRecord[] {
  const records = owner
    ? manifestOwnership.filter((record) => record.owner === owner)
    : manifestOwnership;
  const failingId = failureClass ? injectedFailureCommandId(failureClass) : null;
  return records.map((record) => ({
    id: record.id,
    conclusion: record.id === failingId ? "failure" : "success",
    semantics: record.semantics === "advisory" ? "advisory" : "blocking",
    diagnostics: record.id === failingId ? [injectedFailureDiagnostic(record.id)] : [],
  }));
}

function securityResults(owner?: keyof typeof LANE_OWNERSHIP): ResultRecord[] {
  return SECURITY_OWNERSHIP.filter(
    (record) =>
      !owner ||
      record.owner === owner ||
      (owner === "validate-synthesis" && record.id === "security-upload"),
  ).map((record) => ({
    id: record.id,
    conclusion: "success",
    semantics: record.semantics === "blocking" ? "blocking" : "advisory",
    diagnostics: [],
  }));
}

function timestamp(run: number, minutes: number): string {
  return new Date(
    Date.parse("2026-05-20T00:00:00.000Z") + run * 24 * 60 * 60_000 + minutes * 60_000,
  ).toISOString();
}

function makeObservation(
  run: number,
  architectureVersion: Observation["architectureVersion"],
  lane: Observation["lane"],
  injectedFailure: Observation["injectedFailure"] = "none",
): Observation {
  const sourceRunId = String(10_000 + run);
  const isMonolith = architectureVersion === "monolithic";
  const jobIdentity = isMonolith
    ? "validate"
    : lane === "validate-synthesis"
      ? architectureVersion === "shadow-split"
        ? "split-validation-shadow"
        : "validate"
      : lane;
  const failedLane = injectedFailure !== "none" && (isMonolith || lane === injectedFailure);
  const synthesisFailed = lane === "validate-synthesis" && injectedFailure !== "none";
  const failed = failedLane || synthesisFailed;
  const startMinute = isMonolith ? 2 : lane === "validate-synthesis" ? 22 : 1;
  const completeMinute = isMonolith ? 22 : lane === "validate-synthesis" ? 26 : 6;
  const commandId = injectedFailureCommandId(injectedFailure);
  const diagnostic = commandId ? [injectedFailureDiagnostic(commandId)] : [];
  return {
    schemaVersion: OBSERVATION_SCHEMA,
    sourceRunId,
    sourceAttempt: 1,
    sourceCreatedAt: timestamp(run, 0),
    sourceCompletedAt: timestamp(run, 30),
    sourceSha: SHA,
    architectureVersion,
    jobIdentity,
    lane,
    artifactName: `ci-observation-${sourceRunId}-1`,
    startedAt: timestamp(run, startMinute),
    completedAt: timestamp(run, completeMinute),
    conclusion: failed ? "failure" : "success",
    blockingOutcome: injectedFailure === "none" ? "success" : "failure",
    operationalFailure: false,
    profile: "publish",
    runnerOs: "Linux",
    runnerArch: "X64",
    runnerLabel: "ubuntu-latest",
    nodeVersion: "24.5.0",
    pnpmVersion: "10.15.0",
    turboVersion: "2.5.6",
    toolchainDigest: DIGEST,
    manifestDigest: DIGEST,
    inventoryDigest: DIGEST,
    inputDigest: DIGEST,
    verificationExperimentId: `experiment-${sourceRunId}`,
    evidenceDigest: DIGEST,
    injectedFailure,
    cacheEligibleTaskIds: ["build", "test"],
    validCacheHitTaskIds: ["build"],
    freshAttestation: true,
    checkResults: checkResults(
      isMonolith ? undefined : lane,
      failedLane && injectedFailure !== "none" ? injectedFailure : undefined,
    ),
    securityResults: securityResults(isMonolith ? undefined : lane),
    stableDiagnostics: failedLane ? diagnostic : [],
  };
}

function makeDataset(runCount = 35): Dataset {
  const observations: Observation[] = [];
  const sources: Dataset["inventory"]["sources"][number][] = [];
  const failures: Observation["injectedFailure"][] = [
    "core-verification",
    "generated-apps",
    "package-artifacts",
    "coverage-security",
    "validate-synthesis",
  ];
  for (let run = 0; run < runCount; run += 1) {
    const injected = run >= 5 && run < 10 ? (failures[run - 5] ?? "none") : "none";
    const records = [
      makeObservation(run, "monolithic", "monolithic", injected),
      makeObservation(run, "shadow-split", "core-verification", injected),
      makeObservation(run, "shadow-split", "generated-apps", injected),
      makeObservation(run, "shadow-split", "package-artifacts", injected),
      makeObservation(run, "shadow-split", "coverage-security", injected),
      makeObservation(run, "shadow-split", "validate-synthesis", injected),
    ];
    observations.push(...records);
    const sourceRunId = records[0]?.sourceRunId ?? "";
    sources.push({
      sourceRunId,
      sourceAttempt: 1,
      createdAt: records[0]?.sourceCreatedAt ?? "",
      artifactName: `ci-observation-${sourceRunId}-1`,
      expectedRecordKeys: records.map(observationKey),
    });
  }
  return {
    schemaVersion: DATASET_SCHEMA,
    inventory: {
      schemaVersion: INVENTORY_SCHEMA,
      cutoffAt: CUTOFF,
      windowStartedAt: WINDOW_START,
      retentionDays: 90,
      sourceRunCount: sources.length,
      eligibleSourceCount: sources.length,
      artifactCount: sources.length,
      pages: [
        {
          query: "source-runs",
          cursor: null,
          nextCursor: "page-2",
          totalCount: sources.length,
          itemCount: Math.min(20, sources.length),
          sourceRunIds: sources.slice(0, 20).map(({ sourceRunId }) => sourceRunId),
          artifactNames: [],
        },
        {
          query: "source-runs",
          cursor: "page-2",
          nextCursor: null,
          totalCount: sources.length,
          itemCount: Math.max(0, sources.length - 20),
          sourceRunIds: sources.slice(20).map(({ sourceRunId }) => sourceRunId),
          artifactNames: [],
        },
        {
          query: "observer-artifacts:1",
          cursor: null,
          nextCursor: null,
          totalCount: sources.length,
          itemCount: sources.length,
          sourceRunIds: [],
          artifactNames: sources.map(({ artifactName }) => artifactName),
        },
      ],
      cohort: {
        profile: "publish",
        runnerOs: "Linux",
        runnerArch: "X64",
        runnerLabel: "ubuntu-latest",
        nodeVersion: "24.5.0",
        pnpmVersion: "10.15.0",
        turboVersion: "2.5.6",
        toolchainDigest: DIGEST,
      },
      ownership: { manifest: manifestOwnership, security: [...SECURITY_OWNERSHIP] },
      sources,
      excludedSources: [],
      operationalSources: [],
    },
    observations,
  };
}

describe("cacheable CI lane evaluator contract", () => {
  it("strictly rejects unknown observation fields and invalid cache hits", () => {
    const observation = makeObservation(0, "monolithic", "monolithic");
    expect(() => parseObservation({ ...observation, unexpected: true })).toThrow(/keys must equal/);
    expect(() =>
      parseObservation({ ...observation, validCacheHitTaskIds: ["not-eligible"] }),
    ).toThrow(/must be a subset/);
  });

  it("validates the exact 53-check and five-security ownership ledger", () => {
    expect(manifestOwnership).toHaveLength(53);
    expect(SECURITY_OWNERSHIP).toHaveLength(5);
    const passing = evaluateDataset(makeDataset(1), { contractOnly: true });
    expect(passing.failed).toBe(false);

    const mutant = structuredClone(makeDataset(1));
    mutant.inventory.ownership.manifest.pop();
    expect(evaluateDataset(mutant, { contractOnly: true }).diagnostics).toEqual([
      expect.objectContaining({
        code: "DATASET_INVALID",
        message: expect.stringContaining("ownership"),
      }),
    ]);
  });

  it("classifies cache sets and uses nearest-rank p95", () => {
    expect(nearestRankP95(Array.from({ length: 30 }, (_, index) => index + 1))).toBe(29);
    const mutant = makeObservation(0, "monolithic", "monolithic");
    expect(evaluateDataset(makeDataset(1), { contractOnly: true }).failed).toBe(false);
    expect(() => parseObservation({ ...mutant, validCacheHitTaskIds: ["build", "build"] })).toThrow(
      /must not contain duplicates/,
    );
  });

  it("fails closed on pagination gaps, duplicate unique keys, missing records, and cutoff drift", () => {
    const cases = [
      (dataset: Dataset) => {
        dataset.inventory.pages[1] = { ...dataset.inventory.pages[1], cursor: "gap" };
      },
      (dataset: Dataset) => {
        dataset.observations.push(dataset.observations[0] as Observation);
      },
      (dataset: Dataset) => {
        dataset.observations.pop();
      },
      (dataset: Dataset) => {
        dataset.inventory.windowStartedAt = "2026-05-17T00:00:00.000Z";
      },
    ];
    for (const mutate of cases) {
      const dataset = structuredClone(makeDataset(1));
      mutate(dataset);
      expect(evaluateDataset(dataset, { contractOnly: true }).failed).toBe(true);
    }
  });
});

describe("cacheable CI lane promotion gates", () => {
  it("passes 30 recent samples, equivalence coverage, and the <=25% runner-cost gate", () => {
    const report = evaluateDataset(makeDataset());
    expect(report.diagnostics).toEqual([]);
    expect(report.primary).toEqual({
      sampleCount: 30,
      p95WallMinutes: 26,
      p95CriticalMinutes: 25,
      maximumJobMinutes: 5,
    });
    expect(report.equivalence).toEqual({
      pairCount: 30,
      coveredFailureClasses: [
        "core-verification",
        "coverage-security",
        "generated-apps",
        "none",
        "package-artifacts",
        "validate-synthesis",
      ],
    });
    expect(report.runnerCost?.regression).toBeCloseTo(0.2);
  });

  it("normal evaluation fails when fewer than 30 live samples exist", () => {
    const report = evaluateDataset(makeDataset(1));
    expect(report.failed).toBe(true);
    expect(report.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "FAILURE_CLASS_COVERAGE_INCOMPLETE",
        "INSUFFICIENT_EQUIVALENCE_PAIRS",
        "INSUFFICIENT_PRIMARY_SAMPLES",
      ]),
    );
  });

  it("does not count a labeled failure class without the exact injected diagnostic", () => {
    const dataset = structuredClone(makeDataset());
    const sourceRecords = dataset.observations.filter(({ sourceRunId }) => sourceRunId === "10005");
    for (const record of sourceRecords) {
      const target = record.checkResults.find(({ id }) => id === "verification-policy");
      if (!target) continue;
      target.diagnostics = ["verification-policy:natural failure"];
      record.stableDiagnostics = ["verification-policy:natural failure"];
    }

    const report = evaluateDataset(dataset);
    expect(report.failed).toBe(true);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "DATASET_INVALID",
        message: expect.stringContaining("lacks exact injected failure evidence"),
      }),
    ]);
  });

  it("rejects pair identity/result drift and stale attestations", () => {
    for (const mutate of [
      (record: Observation) => {
        record.manifestDigest = "c".repeat(64);
      },
      (record: Observation) => {
        record.checkResults[0] = { ...record.checkResults[0], conclusion: "failure" };
      },
      (record: Observation) => {
        record.freshAttestation = false;
      },
    ]) {
      const dataset = structuredClone(makeDataset());
      const record = dataset.observations.find(
        ({ sourceRunId, architectureVersion, lane }) =>
          sourceRunId === "10034" &&
          architectureVersion === "shadow-split" &&
          lane === "core-verification",
      );
      expect(record).toBeDefined();
      mutate(record as Observation);
      expect(evaluateDataset(dataset).failed).toBe(true);
    }
  });

  it("enforces wall, critical path, lane duration, warm/cold, and runner-minute budgets", () => {
    const dataset = structuredClone(makeDataset(65));
    for (const record of dataset.observations) {
      if (Number(record.sourceRunId) < 10_035) continue;
      record.sourceCompletedAt = timestamp(Number(record.sourceRunId) - 10_000, 50);
      if (record.architectureVersion !== "shadow-split") continue;
      record.validCacheHitTaskIds = [...record.cacheEligibleTaskIds];
      if (record.lane === "validate-synthesis") {
        record.startedAt = timestamp(Number(record.sourceRunId) - 10_000, 10);
        record.completedAt = timestamp(Number(record.sourceRunId) - 10_000, 47);
      }
    }
    const report = evaluateDataset(dataset);
    expect(report.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "LANE_DURATION_BUDGET_EXCEEDED",
        "PRIMARY_CRITICAL_BUDGET_EXCEEDED",
        "PRIMARY_WALL_BUDGET_EXCEEDED",
        "RUNNER_COST_REGRESSION_EXCEEDED",
        "WARM_WALL_BUDGET_EXCEEDED",
      ]),
    );
  });

  it("emits deterministic JSON and exits non-zero for insufficient CLI input", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-cacheable-evaluator-"));
    DIRECTORIES.push(directory);
    const input = join(directory, "dataset.json");
    writeFileSync(input, `${JSON.stringify(makeDataset(1))}\n`);
    const command = [
      "--experimental-strip-types",
      "scripts/ci-cacheable-lanes-evaluator.mts",
      "--input",
      input,
    ];
    const first = spawnSync(process.execPath, command, { encoding: "utf8" });
    const second = spawnSync(process.execPath, command, { encoding: "utf8" });
    expect(first.status).toBe(1);
    expect(first.stdout).toBe(second.stdout);
    expect(JSON.parse(first.stdout)).toEqual(expect.objectContaining({ failed: true }));

    const contract = spawnSync(process.execPath, [...command, "--contract-only"], {
      encoding: "utf8",
    });
    expect(contract.status).toBe(0);
    expect(JSON.parse(contract.stdout)).toEqual(expect.objectContaining({ failed: false }));
  });
});
