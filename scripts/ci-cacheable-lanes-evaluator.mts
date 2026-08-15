#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import {
  injectedFailureCommandId,
  injectedFailureDiagnostic,
} from "./ci-cacheable-failure-injection.mts";
import { VERIFICATION_LANE_OWNERSHIP } from "./verification-manifest.mts";
export { SECURITY_OWNERSHIP };

export const DATASET_SCHEMA = "croco.ci-cacheable-lanes-dataset/v1" as const;
export const INVENTORY_SCHEMA = "croco.ci-cacheable-lanes-inventory/v2" as const;
export const OBSERVATION_SCHEMA = "croco.ci-cacheable-lanes-observation/v1" as const;
export const REPORT_SCHEMA = "croco.ci-cacheable-lanes-evaluation/v1" as const;
export const RETENTION_DAYS = 90;
export const SAMPLE_WINDOW = 30;

const EVALUATOR_LANES = [
  "core-verification",
  "generated-apps",
  "package-artifacts",
  "coverage-security",
  "validate-synthesis",
] as const;

type EvaluatorLane = (typeof EVALUATOR_LANES)[number];

export const LANE_OWNERSHIP = Object.fromEntries(
  EVALUATOR_LANES.map((lane) => [
    lane,
    Object.entries(VERIFICATION_LANE_OWNERSHIP)
      .filter(([, owner]) =>
        lane === "validate-synthesis" ? owner === "split-validation-shadow" : owner === lane,
      )
      .map(([id]) => id),
  ]),
) as Readonly<Record<EvaluatorLane, readonly string[]>>;

type ArchitectureVersion = "monolithic" | "shadow-split" | "cutover-split";
type CacheCohort = "cold" | "partial" | "warm" | "no-cache";
type Conclusion = "success" | "failure" | "cancelled" | "skipped";
type FailureClass = "none" | keyof typeof LANE_OWNERSHIP;
type Semantics = "blocking" | "advisory";

export type OwnershipRecord = {
  readonly id: string;
  readonly owner: string;
  readonly semantics: string;
};
export type ResultRecord = {
  readonly id: string;
  readonly conclusion: "success" | "failure" | "not-selected";
  readonly semantics: Semantics;
  readonly diagnostics: readonly string[];
};
export type Observation = {
  readonly schemaVersion: typeof OBSERVATION_SCHEMA;
  readonly sourceRunId: string;
  readonly sourceAttempt: number;
  readonly sourceCreatedAt: string;
  readonly sourceCompletedAt: string;
  readonly sourceSha: string;
  readonly architectureVersion: ArchitectureVersion;
  readonly jobIdentity: string;
  readonly lane: "monolithic" | keyof typeof LANE_OWNERSHIP;
  readonly artifactName: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly conclusion: Conclusion;
  readonly blockingOutcome: "success" | "failure";
  readonly operationalFailure: boolean;
  readonly profile: string;
  readonly runnerOs: string;
  readonly runnerArch: string;
  readonly runnerLabel: string;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly turboVersion: string;
  readonly toolchainDigest: string;
  readonly manifestDigest: string;
  readonly inventoryDigest: string;
  readonly inputDigest: string;
  readonly verificationExperimentId: string;
  readonly evidenceDigest: string;
  readonly injectedFailure: FailureClass;
  readonly cacheEligibleTaskIds: readonly string[];
  readonly validCacheHitTaskIds: readonly string[];
  readonly freshAttestation: boolean;
  readonly checkResults: readonly ResultRecord[];
  readonly securityResults: readonly ResultRecord[];
  readonly stableDiagnostics: readonly string[];
};

export type Inventory = {
  readonly schemaVersion: typeof INVENTORY_SCHEMA;
  readonly cutoffAt: string;
  readonly windowStartedAt: string;
  readonly cohortStartedAt: string;
  readonly retentionDays: number;
  readonly sourceRunCount: number;
  readonly eligibleSourceCount: number;
  readonly artifactCount: number;
  readonly pages: readonly {
    readonly query: string;
    readonly cursor: string | null;
    readonly nextCursor: string | null;
    readonly totalCount: number;
    readonly itemCount: number;
    readonly sourceRunIds: readonly string[];
    readonly artifactNames: readonly string[];
  }[];
  readonly cohort: {
    readonly profile: "publish";
    readonly runnerOs: string;
    readonly runnerArch: "X64";
    readonly runnerLabel: "ubuntu-latest";
    readonly nodeVersion: string;
    readonly pnpmVersion: string;
    readonly turboVersion: string;
    readonly toolchainDigest: string;
  };
  readonly ownership: {
    readonly manifest: readonly OwnershipRecord[];
    readonly security: readonly OwnershipRecord[];
  };
  readonly sources: readonly {
    readonly sourceRunId: string;
    readonly sourceAttempt: number;
    readonly createdAt: string;
    readonly artifactName: string;
    readonly expectedRecordKeys: readonly string[];
  }[];
  readonly excludedSources: readonly {
    readonly sourceRunId: string;
    readonly sourceAttempt: number;
    readonly createdAt: string;
    readonly reason: string;
  }[];
  readonly operationalSources: readonly {
    readonly sourceRunId: string;
    readonly sourceAttempt: number;
    readonly createdAt: string;
    readonly reason: string;
  }[];
};

export type Dataset = {
  readonly schemaVersion: typeof DATASET_SCHEMA;
  readonly inventory: Inventory;
  readonly observations: readonly Observation[];
};

export type Diagnostic = { readonly code: string; readonly key?: string; readonly message: string };
export type EvaluationReport = {
  readonly schemaVersion: typeof REPORT_SCHEMA;
  readonly mode: "contract-only" | "promotion";
  readonly cutoffAt?: string;
  readonly observationCount: number;
  readonly failed: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly cohorts: Readonly<Record<string, { sampleCount: number; p95WallMinutes?: number }>>;
  readonly primary?: {
    readonly sampleCount: number;
    readonly p95WallMinutes: number;
    readonly p95CriticalMinutes: number;
    readonly maximumJobMinutes: number;
  };
  readonly equivalence?: {
    readonly pairCount: number;
    readonly coveredFailureClasses: readonly string[];
  };
  readonly runnerCost?: {
    readonly monolithicMedianMinutes: number;
    readonly splitMedianMinutes: number;
    readonly regression: number;
  };
};

const EXPECTED_MANIFEST = Object.entries(LANE_OWNERSHIP).flatMap(([owner, ids]) =>
  ids.map((id) => ({
    id,
    owner,
    semantics: id === "core-coverage-warning" ? "advisory" : "blocking",
  })),
);
const PRODUCERS = [
  "core-verification",
  "generated-apps",
  "package-artifacts",
  "coverage-security",
] as const;
const FAILURE_CLASSES = [
  "core-verification",
  "generated-apps",
  "package-artifacts",
  "coverage-security",
  "validate-synthesis",
] as const;
const MINUTE = 60_000;

function fail(message: string): never {
  throw new Error(message);
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    fail(`${path} must be an object`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(`${path} keys must equal ${expected.join(",")}`);
}
function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${path} must be a non-empty string`);
  return value;
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(`${path} must be a boolean`);
  return value;
}
function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum)
    fail(`${path} must be an integer >= ${minimum}`);
  return value as number;
}
function enumeration<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    fail(`${path} must be one of ${allowed.join(",")}`);
  return value as T;
}
function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}
function strings(value: unknown, path: string): readonly string[] {
  return array(value, path).map((entry, index) => string(entry, `${path}[${index}]`));
}
function timestamp(value: unknown, path: string): string {
  const result = string(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    fail(`${path} must be an ISO-8601 UTC timestamp`);
  return result;
}
function digest(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^[a-f0-9]{64}$/.test(result)) fail(`${path} must be a lowercase sha256 digest`);
  return result;
}
function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) fail(`${path} must not contain duplicates`);
}

function parseOwnership(value: unknown, path: string): OwnershipRecord {
  const entry = object(value, path);
  exactKeys(entry, ["id", "owner", "semantics"], path);
  return {
    id: string(entry.id, `${path}.id`),
    owner: string(entry.owner, `${path}.owner`),
    semantics: string(entry.semantics, `${path}.semantics`),
  };
}

function parseResult(value: unknown, path: string): ResultRecord {
  const entry = object(value, path);
  exactKeys(entry, ["id", "conclusion", "semantics", "diagnostics"], path);
  const diagnostics = strings(entry.diagnostics, `${path}.diagnostics`);
  unique(diagnostics, `${path}.diagnostics`);
  return {
    id: string(entry.id, `${path}.id`),
    conclusion: enumeration(
      entry.conclusion,
      ["success", "failure", "not-selected"],
      `${path}.conclusion`,
    ),
    semantics: enumeration(entry.semantics, ["blocking", "advisory"], `${path}.semantics`),
    diagnostics,
  };
}

export function parseObservation(value: unknown, path = "observation"): Observation {
  const entry = object(value, path);
  const keys = [
    "schemaVersion",
    "sourceRunId",
    "sourceAttempt",
    "sourceCreatedAt",
    "sourceCompletedAt",
    "sourceSha",
    "architectureVersion",
    "jobIdentity",
    "lane",
    "artifactName",
    "startedAt",
    "completedAt",
    "conclusion",
    "blockingOutcome",
    "operationalFailure",
    "profile",
    "runnerOs",
    "runnerArch",
    "runnerLabel",
    "nodeVersion",
    "pnpmVersion",
    "turboVersion",
    "toolchainDigest",
    "manifestDigest",
    "inventoryDigest",
    "inputDigest",
    "verificationExperimentId",
    "evidenceDigest",
    "injectedFailure",
    "cacheEligibleTaskIds",
    "validCacheHitTaskIds",
    "freshAttestation",
    "checkResults",
    "securityResults",
    "stableDiagnostics",
  ];
  exactKeys(entry, keys, path);
  if (entry.schemaVersion !== OBSERVATION_SCHEMA)
    fail(`${path}.schemaVersion must equal ${OBSERVATION_SCHEMA}`);
  const eligible = strings(entry.cacheEligibleTaskIds, `${path}.cacheEligibleTaskIds`);
  const hits = strings(entry.validCacheHitTaskIds, `${path}.validCacheHitTaskIds`);
  const stableDiagnostics = strings(entry.stableDiagnostics, `${path}.stableDiagnostics`);
  unique(eligible, `${path}.cacheEligibleTaskIds`);
  unique(hits, `${path}.validCacheHitTaskIds`);
  unique(stableDiagnostics, `${path}.stableDiagnostics`);
  if (hits.some((hit) => !eligible.includes(hit)))
    fail(`${path}.validCacheHitTaskIds must be a subset of cacheEligibleTaskIds`);
  const sourceSha = string(entry.sourceSha, `${path}.sourceSha`);
  if (!/^[a-f0-9]{40}$/.test(sourceSha))
    fail(`${path}.sourceSha must be a lowercase 40-character git SHA`);
  const observation: Observation = {
    schemaVersion: OBSERVATION_SCHEMA,
    sourceRunId: string(entry.sourceRunId, `${path}.sourceRunId`),
    sourceAttempt: integer(entry.sourceAttempt, `${path}.sourceAttempt`, 1),
    sourceCreatedAt: timestamp(entry.sourceCreatedAt, `${path}.sourceCreatedAt`),
    sourceCompletedAt: timestamp(entry.sourceCompletedAt, `${path}.sourceCompletedAt`),
    sourceSha,
    architectureVersion: enumeration(
      entry.architectureVersion,
      ["monolithic", "shadow-split", "cutover-split"],
      `${path}.architectureVersion`,
    ),
    jobIdentity: string(entry.jobIdentity, `${path}.jobIdentity`),
    lane: enumeration(entry.lane, ["monolithic", ...FAILURE_CLASSES], `${path}.lane`),
    artifactName: string(entry.artifactName, `${path}.artifactName`),
    startedAt: timestamp(entry.startedAt, `${path}.startedAt`),
    completedAt: timestamp(entry.completedAt, `${path}.completedAt`),
    conclusion: enumeration(
      entry.conclusion,
      ["success", "failure", "cancelled", "skipped"],
      `${path}.conclusion`,
    ),
    blockingOutcome: enumeration(
      entry.blockingOutcome,
      ["success", "failure"],
      `${path}.blockingOutcome`,
    ),
    operationalFailure: boolean(entry.operationalFailure, `${path}.operationalFailure`),
    profile: string(entry.profile, `${path}.profile`),
    runnerOs: string(entry.runnerOs, `${path}.runnerOs`),
    runnerArch: string(entry.runnerArch, `${path}.runnerArch`),
    runnerLabel: string(entry.runnerLabel, `${path}.runnerLabel`),
    nodeVersion: string(entry.nodeVersion, `${path}.nodeVersion`),
    pnpmVersion: string(entry.pnpmVersion, `${path}.pnpmVersion`),
    turboVersion: string(entry.turboVersion, `${path}.turboVersion`),
    toolchainDigest: digest(entry.toolchainDigest, `${path}.toolchainDigest`),
    manifestDigest: digest(entry.manifestDigest, `${path}.manifestDigest`),
    inventoryDigest: digest(entry.inventoryDigest, `${path}.inventoryDigest`),
    inputDigest: digest(entry.inputDigest, `${path}.inputDigest`),
    verificationExperimentId: string(
      entry.verificationExperimentId,
      `${path}.verificationExperimentId`,
    ),
    evidenceDigest: digest(entry.evidenceDigest, `${path}.evidenceDigest`),
    injectedFailure: enumeration(
      entry.injectedFailure,
      ["none", ...FAILURE_CLASSES],
      `${path}.injectedFailure`,
    ),
    cacheEligibleTaskIds: eligible,
    validCacheHitTaskIds: hits,
    freshAttestation: boolean(entry.freshAttestation, `${path}.freshAttestation`),
    checkResults: array(entry.checkResults, `${path}.checkResults`).map((result, index) =>
      parseResult(result, `${path}.checkResults[${index}]`),
    ),
    securityResults: array(entry.securityResults, `${path}.securityResults`).map((result, index) =>
      parseResult(result, `${path}.securityResults[${index}]`),
    ),
    stableDiagnostics,
  };
  if (
    !(
      Date.parse(observation.sourceCreatedAt) <= Date.parse(observation.startedAt) &&
      Date.parse(observation.startedAt) <= Date.parse(observation.completedAt) &&
      Date.parse(observation.completedAt) <= Date.parse(observation.sourceCompletedAt)
    )
  )
    fail(
      `${path} timestamps must be ordered sourceCreatedAt <= startedAt <= completedAt <= sourceCompletedAt`,
    );
  return observation;
}

function parseInventory(value: unknown, path = "inventory"): Inventory {
  const entry = object(value, path);
  exactKeys(
    entry,
    [
      "schemaVersion",
      "cutoffAt",
      "windowStartedAt",
      "cohortStartedAt",
      "retentionDays",
      "sourceRunCount",
      "eligibleSourceCount",
      "artifactCount",
      "pages",
      "cohort",
      "ownership",
      "sources",
      "excludedSources",
      "operationalSources",
    ],
    path,
  );
  if (entry.schemaVersion !== INVENTORY_SCHEMA)
    fail(`${path}.schemaVersion must equal ${INVENTORY_SCHEMA}`);
  const cohortValue = object(entry.cohort, `${path}.cohort`);
  exactKeys(
    cohortValue,
    [
      "profile",
      "runnerOs",
      "runnerArch",
      "runnerLabel",
      "nodeVersion",
      "pnpmVersion",
      "turboVersion",
      "toolchainDigest",
    ],
    `${path}.cohort`,
  );
  if (
    cohortValue.profile !== "publish" ||
    cohortValue.runnerArch !== "X64" ||
    cohortValue.runnerLabel !== "ubuntu-latest"
  )
    fail(`${path}.cohort must target publish/ubuntu-latest/X64`);
  const ownershipValue = object(entry.ownership, `${path}.ownership`);
  exactKeys(ownershipValue, ["manifest", "security"], `${path}.ownership`);
  const pages = array(entry.pages, `${path}.pages`).map((value, index) => {
    const page = object(value, `${path}.pages[${index}]`);
    exactKeys(
      page,
      ["query", "cursor", "nextCursor", "totalCount", "itemCount", "sourceRunIds", "artifactNames"],
      `${path}.pages[${index}]`,
    );
    const nullable = (candidate: unknown, name: string): string | null =>
      candidate === null ? null : string(candidate, name);
    return {
      query: string(page.query, `${path}.pages[${index}].query`),
      cursor: nullable(page.cursor, `${path}.pages[${index}].cursor`),
      nextCursor: nullable(page.nextCursor, `${path}.pages[${index}].nextCursor`),
      totalCount: integer(page.totalCount, `${path}.pages[${index}].totalCount`),
      itemCount: integer(page.itemCount, `${path}.pages[${index}].itemCount`),
      sourceRunIds: strings(page.sourceRunIds, `${path}.pages[${index}].sourceRunIds`),
      artifactNames: strings(page.artifactNames, `${path}.pages[${index}].artifactNames`),
    };
  });
  const sources = array(entry.sources, `${path}.sources`).map((value, index) => {
    const source = object(value, `${path}.sources[${index}]`);
    exactKeys(
      source,
      ["sourceRunId", "sourceAttempt", "createdAt", "artifactName", "expectedRecordKeys"],
      `${path}.sources[${index}]`,
    );
    const expectedRecordKeys = strings(
      source.expectedRecordKeys,
      `${path}.sources[${index}].expectedRecordKeys`,
    );
    unique(expectedRecordKeys, `${path}.sources[${index}].expectedRecordKeys`);
    return {
      sourceRunId: string(source.sourceRunId, `${path}.sources[${index}].sourceRunId`),
      sourceAttempt: integer(source.sourceAttempt, `${path}.sources[${index}].sourceAttempt`, 1),
      createdAt: timestamp(source.createdAt, `${path}.sources[${index}].createdAt`),
      artifactName: string(source.artifactName, `${path}.sources[${index}].artifactName`),
      expectedRecordKeys,
    };
  });
  const parseExcludedSource = (value: unknown, sourcePath: string) => {
    const source = object(value, sourcePath);
    exactKeys(source, ["sourceRunId", "sourceAttempt", "createdAt", "reason"], sourcePath);
    return {
      sourceRunId: string(source.sourceRunId, `${sourcePath}.sourceRunId`),
      sourceAttempt: integer(source.sourceAttempt, `${sourcePath}.sourceAttempt`, 1),
      createdAt: timestamp(source.createdAt, `${sourcePath}.createdAt`),
      reason: string(source.reason, `${sourcePath}.reason`),
    };
  };
  const excludedSources = array(entry.excludedSources, `${path}.excludedSources`).map(
    (value, index) => parseExcludedSource(value, `${path}.excludedSources[${index}]`),
  );
  const operationalSources = array(entry.operationalSources, `${path}.operationalSources`).map(
    (value, index) => parseExcludedSource(value, `${path}.operationalSources[${index}]`),
  );
  return {
    schemaVersion: INVENTORY_SCHEMA,
    cutoffAt: timestamp(entry.cutoffAt, `${path}.cutoffAt`),
    windowStartedAt: timestamp(entry.windowStartedAt, `${path}.windowStartedAt`),
    cohortStartedAt: timestamp(entry.cohortStartedAt, `${path}.cohortStartedAt`),
    retentionDays: integer(entry.retentionDays, `${path}.retentionDays`, 1),
    sourceRunCount: integer(entry.sourceRunCount, `${path}.sourceRunCount`),
    eligibleSourceCount: integer(entry.eligibleSourceCount, `${path}.eligibleSourceCount`),
    artifactCount: integer(entry.artifactCount, `${path}.artifactCount`),
    pages,
    cohort: {
      profile: "publish",
      runnerOs: string(cohortValue.runnerOs, `${path}.cohort.runnerOs`),
      runnerArch: "X64",
      runnerLabel: "ubuntu-latest",
      nodeVersion: string(cohortValue.nodeVersion, `${path}.cohort.nodeVersion`),
      pnpmVersion: string(cohortValue.pnpmVersion, `${path}.cohort.pnpmVersion`),
      turboVersion: string(cohortValue.turboVersion, `${path}.cohort.turboVersion`),
      toolchainDigest: digest(cohortValue.toolchainDigest, `${path}.cohort.toolchainDigest`),
    },
    ownership: {
      manifest: array(ownershipValue.manifest, `${path}.ownership.manifest`).map((item, index) =>
        parseOwnership(item, `${path}.ownership.manifest[${index}]`),
      ),
      security: array(ownershipValue.security, `${path}.ownership.security`).map((item, index) =>
        parseOwnership(item, `${path}.ownership.security[${index}]`),
      ),
    },
    sources,
    excludedSources,
    operationalSources,
  };
}

export function parseDataset(value: unknown): Dataset {
  const entry = object(value, "dataset");
  exactKeys(entry, ["schemaVersion", "inventory", "observations"], "dataset");
  if (entry.schemaVersion !== DATASET_SCHEMA)
    fail(`dataset.schemaVersion must equal ${DATASET_SCHEMA}`);
  return {
    schemaVersion: DATASET_SCHEMA,
    inventory: parseInventory(entry.inventory),
    observations: array(entry.observations, "dataset.observations").map((item, index) =>
      parseObservation(item, `dataset.observations[${index}]`),
    ),
  };
}

export function observationKey(
  observation: Pick<
    Observation,
    "sourceRunId" | "sourceAttempt" | "architectureVersion" | "jobIdentity"
  >,
): string {
  return [
    observation.sourceRunId,
    observation.sourceAttempt,
    observation.architectureVersion,
    observation.jobIdentity,
  ].join("/");
}

export function classifyCacheCohort(
  eligible: readonly string[],
  hits: readonly string[],
): CacheCohort {
  if (eligible.length === 0) return "no-cache";
  if (hits.length === 0) return "cold";
  return hits.length === eligible.length ? "warm" : "partial";
}

export function nearestRankP95(values: readonly number[]): number {
  if (values.length === 0) fail("nearest-rank p95 requires at least one value");
  return [...values].sort((left, right) => left - right)[Math.ceil(0.95 * values.length) - 1];
}

export function median(values: readonly number[]): number {
  if (values.length === 0) fail("median requires at least one value");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function setEquality(
  actual: readonly OwnershipRecord[],
  expected: readonly OwnershipRecord[],
  name: string,
): void {
  const normalize = (records: readonly OwnershipRecord[]) =>
    records.map((record) => stable(record)).sort();
  if (stable(normalize(actual)) !== stable(normalize(expected)))
    fail(`${name} ownership must equal the declared contract`);
}
function resultSet(records: readonly ResultRecord[]): string {
  return stable(
    [...records]
      .map((record) => ({ ...record, diagnostics: [...record.diagnostics].sort() }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}
function recordResultContract(observation: Observation): void {
  const expectedChecks =
    observation.architectureVersion === "monolithic"
      ? EXPECTED_MANIFEST
      : EXPECTED_MANIFEST.filter(({ owner }) => owner === observation.lane);
  const actualChecks = observation.checkResults.map(({ id, semantics }) => ({
    id,
    owner:
      observation.architectureVersion === "monolithic"
        ? (EXPECTED_MANIFEST.find((entry) => entry.id === id)?.owner ?? "")
        : observation.lane,
    semantics,
  }));
  setEquality(actualChecks, expectedChecks, `${observationKey(observation)} check-result`);
  const expectedSecurity =
    observation.architectureVersion === "monolithic"
      ? SECURITY_OWNERSHIP
      : SECURITY_OWNERSHIP.filter(
          ({ id, owner }) =>
            owner === observation.lane ||
            (observation.lane === "validate-synthesis" && id === "security-upload"),
        );
  const actualSecurity = observation.securityResults.map(
    ({ id }) =>
      SECURITY_OWNERSHIP.find((entry) => entry.id === id) ?? { id, owner: "", semantics: "" },
  );
  setEquality(actualSecurity, expectedSecurity, `${observationKey(observation)} security-result`);
}
function sameCohort(observation: Observation, cohort: Inventory["cohort"]): boolean {
  return (
    observation.profile === cohort.profile &&
    observation.runnerOs === cohort.runnerOs &&
    observation.runnerArch === cohort.runnerArch &&
    observation.runnerLabel === cohort.runnerLabel &&
    observation.nodeVersion === cohort.nodeVersion &&
    observation.pnpmVersion === cohort.pnpmVersion &&
    observation.turboVersion === cohort.turboVersion &&
    observation.toolchainDigest === cohort.toolchainDigest
  );
}
function architectureGroups(observations: readonly Observation[]): Map<string, Observation[]> {
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) {
    const key = `${observation.sourceRunId}/${observation.sourceAttempt}/${observation.architectureVersion}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return groups;
}
function architectureMetrics(records: readonly Observation[]): {
  wall: number;
  critical: number;
  maxJob: number;
  runner: number;
  synthesis: Observation;
} {
  const architecture = records[0]?.architectureVersion;
  const synthesis =
    architecture === "monolithic"
      ? records.find(({ jobIdentity }) => jobIdentity === "validate")
      : records.find(({ lane }) => lane === "validate-synthesis");
  if (!synthesis) fail(`architecture ${architecture} is missing its synthesis identity`);
  const starts =
    architecture === "monolithic"
      ? [synthesis.startedAt]
      : records
          .filter(({ lane }) => PRODUCERS.includes(lane as (typeof PRODUCERS)[number]))
          .map(({ startedAt }) => startedAt);
  if (starts.length === 0) fail(`architecture ${architecture} has no producer start timestamp`);
  const durations = records.map(
    ({ startedAt, completedAt }) => Date.parse(completedAt) - Date.parse(startedAt),
  );
  return {
    wall: Date.parse(synthesis.completedAt) - Date.parse(synthesis.sourceCreatedAt),
    critical: Date.parse(synthesis.completedAt) - Math.min(...starts.map(Date.parse)),
    maxJob: Math.max(...durations),
    runner: durations.reduce((sum, value) => sum + value, 0),
    synthesis,
  };
}
function architectureResults(records: readonly Observation[]): {
  checks: string;
  security: string;
  diagnostics: string;
  outcome: string;
} {
  const synthesis = records.find(
    ({ lane }) => lane === "monolithic" || lane === "validate-synthesis",
  );
  if (!synthesis) fail("architecture results require synthesis");
  return {
    checks: resultSet(records.flatMap(({ checkResults }) => checkResults)),
    security: resultSet(records.flatMap(({ securityResults }) => securityResults)),
    diagnostics: stable(records.flatMap(({ stableDiagnostics }) => stableDiagnostics).sort()),
    outcome: synthesis.blockingOutcome,
  };
}

function assertInjectedFailureEvidence(records: readonly Observation[]): void {
  const failureClass = records[0]?.injectedFailure;
  if (!failureClass || failureClass === "none") return;
  const commandId = injectedFailureCommandId(failureClass);
  if (!commandId) fail(`source ${records[0]?.sourceRunId} has no injected failure command`);
  const matches = records.flatMap(({ checkResults }) =>
    checkResults.filter(({ id }) => id === commandId),
  );
  const expectedDiagnostic = injectedFailureDiagnostic(commandId);
  if (
    matches.length !== 1 ||
    matches[0]?.conclusion !== "failure" ||
    stable(matches[0].diagnostics) !== stable([expectedDiagnostic])
  ) {
    fail(
      `source ${records[0]?.sourceRunId} ${records[0]?.architectureVersion} lacks exact injected failure evidence for ${failureClass}`,
    );
  }
}
function diagnostic(code: string, message: string, key?: string): Diagnostic {
  return key ? { code, key, message } : { code, message };
}

export function evaluateDataset(
  datasetValue: unknown,
  options: { readonly contractOnly?: boolean } = {},
): EvaluationReport {
  try {
    const dataset = parseDataset(datasetValue);
    const { inventory, observations } = dataset;
    if (inventory.retentionDays !== RETENTION_DAYS)
      fail(`inventory.retentionDays must equal ${RETENTION_DAYS}`);
    const cutoff = Date.parse(inventory.cutoffAt);
    const windowStart = Date.parse(inventory.windowStartedAt);
    const cohortStart = Date.parse(inventory.cohortStartedAt);
    if (windowStart !== cutoff - RETENTION_DAYS * 24 * 60 * MINUTE)
      fail("inventory.windowStartedAt must be exactly 90 days before cutoffAt");
    if (cohortStart < windowStart || cohortStart > cutoff)
      fail("inventory.cohortStartedAt must be within the fixed 90-day window");
    setEquality(inventory.ownership.manifest, EXPECTED_MANIFEST, "manifest");
    setEquality(inventory.ownership.security, SECURITY_OWNERSHIP, "security");
    if (inventory.pages.length === 0) fail("inventory.pages must not be empty");
    const queryPages = new Map<string, typeof inventory.pages>();
    inventory.pages.forEach((page, index) => {
      unique(page.sourceRunIds, `inventory.pages[${index}].sourceRunIds`);
      if (page.sourceRunIds.length + page.artifactNames.length > page.itemCount)
        fail(`inventory.pages[${index}] records exceed itemCount`);
      queryPages.set(page.query, [...(queryPages.get(page.query) ?? []), page]);
    });
    for (const [query, pages] of queryPages) {
      if (pages[0]?.cursor !== null || pages.at(-1)?.nextCursor !== null)
        fail(`inventory query ${query} must contain a complete null-to-null cursor chain`);
      pages.forEach((page, index) => {
        if (index > 0 && page.cursor !== pages[index - 1]?.nextCursor)
          fail(`inventory query ${query} page ${index} does not continue the prior cursor`);
        if (page.itemCount > 100)
          fail(`inventory query ${query} page ${index} exceeds the declared page size`);
      });
      if ((pages.at(-1)?.itemCount ?? 100) >= 100)
        fail(`inventory query ${query} must terminate with a short page`);
    }
    const sourceRunPages = queryPages.get("source-runs");
    if (!sourceRunPages) fail("inventory.pages must include the source-runs query");
    const pagedRuns = sourceRunPages.flatMap(({ sourceRunIds }) => sourceRunIds);
    const pagedArtifacts = inventory.pages
      .filter(({ query }) => query.startsWith("observer-artifacts:"))
      .flatMap(({ artifactNames }) => artifactNames)
      .filter((name) => /^ci-observation-\d+-\d+$/.test(name));
    unique(pagedRuns, "inventory.pages sourceRunIds");
    unique(pagedArtifacts, "inventory.pages artifactNames");
    if (
      pagedRuns.length !== inventory.sourceRunCount ||
      pagedArtifacts.length !== inventory.artifactCount
    )
      fail("inventory page counts must equal sourceRunCount and artifactCount");
    if (inventory.sources.length !== inventory.eligibleSourceCount)
      fail("inventory.sources length must equal eligibleSourceCount");
    const sourceIds = inventory.sources.map(({ sourceRunId }) => sourceRunId);
    const excludedIds = inventory.excludedSources.map(({ sourceRunId }) => sourceRunId);
    const operationalIds = inventory.operationalSources.map(({ sourceRunId }) => sourceRunId);
    const accountedIds = [...sourceIds, ...excludedIds, ...operationalIds];
    unique(accountedIds, "inventory accounted sourceRunIds");
    if (accountedIds.length !== inventory.sourceRunCount)
      fail("eligible, excluded, and operational sources must equal sourceRunCount");
    if (stable([...accountedIds].sort()) !== stable([...pagedRuns].sort()))
      fail("all paginated source runs must be explicitly accounted");
    const sourceArtifacts = inventory.sources.map(({ artifactName }) => artifactName);
    const sourceIdSet = new Set(sourceIds);
    const eligiblePagedArtifacts = pagedArtifacts.filter((artifactName) => {
      const sourceRunId = /^ci-observation-(\d+)-\d+$/.exec(artifactName)?.[1];
      if (!sourceRunId || !accountedIds.includes(sourceRunId))
        fail(`observer artifact ${artifactName} has no accounted source run`);
      return sourceIdSet.has(sourceRunId);
    });
    unique(sourceArtifacts, "inventory.sources artifactName");
    if (stable([...sourceArtifacts].sort()) !== stable([...eligiblePagedArtifacts].sort()))
      fail("inventory source artifacts must equal paginated artifacts");
    const recordsByKey = new Map<string, Observation>();
    for (const observation of observations) {
      const key = observationKey(observation);
      if (recordsByKey.has(key)) fail(`duplicate observation key ${key}`);
      recordsByKey.set(key, observation);
      if (
        Date.parse(observation.sourceCreatedAt) < cohortStart ||
        Date.parse(observation.sourceCreatedAt) > cutoff
      )
        fail(`${key} is outside the trusted cohort window`);
      if (observation.sourceAttempt !== 1) fail(`${key} is not a first-attempt observation`);
      if (!observation.freshAttestation) fail(`${key} lacks a fresh current-run attestation`);
      recordResultContract(observation);
    }
    const expectedKeys: string[] = [];
    for (const source of [
      ...inventory.sources,
      ...inventory.excludedSources,
      ...inventory.operationalSources,
    ]) {
      if (Date.parse(source.createdAt) < windowStart || Date.parse(source.createdAt) > cutoff)
        fail(`source ${source.sourceRunId} is outside the fixed 90-day window`);
    }
    for (const source of inventory.sources) {
      if (Date.parse(source.createdAt) < cohortStart)
        fail(`source ${source.sourceRunId} predates the trusted cohort`);
      if (source.artifactName !== `ci-observation-${source.sourceRunId}-${source.sourceAttempt}`)
        fail(`source ${source.sourceRunId} has an invalid artifact name`);
      for (const key of source.expectedRecordKeys) {
        expectedKeys.push(key);
        const record = recordsByKey.get(key);
        if (!record) fail(`missing expected observation ${key}`);
        if (
          record.sourceRunId !== source.sourceRunId ||
          record.sourceAttempt !== source.sourceAttempt ||
          record.artifactName !== source.artifactName ||
          record.sourceCreatedAt !== source.createdAt
        )
          fail(`observation ${key} provenance does not match its source inventory`);
      }
    }
    unique(expectedKeys, "inventory expectedRecordKeys");
    if (stable([...expectedKeys].sort()) !== stable([...recordsByKey.keys()].sort()))
      fail("observation keys must exactly equal inventory expectedRecordKeys");
    if (options.contractOnly)
      return {
        schemaVersion: REPORT_SCHEMA,
        mode: "contract-only",
        cutoffAt: inventory.cutoffAt,
        observationCount: observations.length,
        failed: false,
        diagnostics: [],
        cohorts: {},
      };

    const diagnostics: Diagnostic[] = [];
    const groups = architectureGroups(observations);
    const splitSuccesses: {
      records: Observation[];
      metrics: ReturnType<typeof architectureMetrics>;
      cohort: CacheCohort;
    }[] = [];
    for (const records of groups.values()) {
      if (!records.every((record) => sameCohort(record, inventory.cohort))) continue;
      const identities = records.map(({ jobIdentity }) => jobIdentity).sort();
      const expected =
        records[0]?.architectureVersion === "monolithic"
          ? ["validate"]
          : records[0]?.architectureVersion === "shadow-split"
            ? [...PRODUCERS, "split-validation-shadow"].sort()
            : [...PRODUCERS, "validate"].sort();
      if (stable(identities) !== stable(expected))
        fail(
          `architecture ${records[0]?.sourceRunId}/${records[0]?.architectureVersion} has incomplete job identities`,
        );
      if (
        records[0]?.architectureVersion !== "monolithic" &&
        records.every(({ conclusion }) => conclusion === "success") &&
        records.every(({ operationalFailure }) => !operationalFailure)
      ) {
        const synthesis = records.find(({ lane }) => lane === "validate-synthesis");
        if (!synthesis) fail("split architecture is missing validate-synthesis");
        splitSuccesses.push({
          records: [...records],
          metrics: architectureMetrics(records),
          cohort: classifyCacheCohort(
            synthesis.cacheEligibleTaskIds,
            synthesis.validCacheHitTaskIds,
          ),
        });
      }
    }
    splitSuccesses.sort(
      (left, right) =>
        Date.parse(left.metrics.synthesis.sourceCreatedAt) -
          Date.parse(right.metrics.synthesis.sourceCreatedAt) ||
        left.metrics.synthesis.sourceRunId.localeCompare(right.metrics.synthesis.sourceRunId),
    );
    const primary = splitSuccesses
      .filter(({ cohort }) => cohort === "partial" || cohort === "warm")
      .slice(-SAMPLE_WINDOW);
    if (primary.length < SAMPLE_WINDOW)
      diagnostics.push(
        diagnostic(
          "INSUFFICIENT_PRIMARY_SAMPLES",
          `primary partial-or-warm cohort requires ${SAMPLE_WINDOW} samples; found ${primary.length}`,
        ),
      );
    let primaryReport: EvaluationReport["primary"];
    if (primary.length > 0) {
      primaryReport = {
        sampleCount: primary.length,
        p95WallMinutes: nearestRankP95(primary.map(({ metrics }) => metrics.wall)) / MINUTE,
        p95CriticalMinutes: nearestRankP95(primary.map(({ metrics }) => metrics.critical)) / MINUTE,
        maximumJobMinutes: Math.max(...primary.map(({ metrics }) => metrics.maxJob)) / MINUTE,
      };
      if (primaryReport.p95WallMinutes >= 35)
        diagnostics.push(
          diagnostic(
            "PRIMARY_WALL_BUDGET_EXCEEDED",
            `primary p95 wall ${primaryReport.p95WallMinutes}m must be <35m`,
          ),
        );
      if (primaryReport.p95CriticalMinutes >= 30)
        diagnostics.push(
          diagnostic(
            "PRIMARY_CRITICAL_BUDGET_EXCEEDED",
            `primary p95 critical path ${primaryReport.p95CriticalMinutes}m must be <30m`,
          ),
        );
      if (primaryReport.maximumJobMinutes > 30)
        diagnostics.push(
          diagnostic(
            "LANE_DURATION_BUDGET_EXCEEDED",
            `maximum lane duration ${primaryReport.maximumJobMinutes}m must be <=30m`,
          ),
        );
    }
    const cohortReports: Record<string, { sampleCount: number; p95WallMinutes?: number }> = {};
    for (const cohort of ["cold", "partial", "warm", "no-cache"] as const) {
      const samples = splitSuccesses
        .filter((sample) => sample.cohort === cohort)
        .slice(-SAMPLE_WINDOW);
      cohortReports[cohort] =
        samples.length === 0
          ? { sampleCount: 0 }
          : {
              sampleCount: samples.length,
              p95WallMinutes: nearestRankP95(samples.map(({ metrics }) => metrics.wall)) / MINUTE,
            };
      if (
        cohort === "warm" &&
        samples.length >= SAMPLE_WINDOW &&
        (cohortReports[cohort].p95WallMinutes ?? Infinity) >= 30
      )
        diagnostics.push(
          diagnostic(
            "WARM_WALL_BUDGET_EXCEEDED",
            `warm p95 wall ${cohortReports[cohort].p95WallMinutes}m must be <30m`,
          ),
        );
      if (
        cohort === "cold" &&
        samples.length >= SAMPLE_WINDOW &&
        (cohortReports[cohort].p95WallMinutes ?? Infinity) >= 45
      )
        diagnostics.push(
          diagnostic(
            "COLD_WALL_BUDGET_EXCEEDED",
            `cold p95 wall ${cohortReports[cohort].p95WallMinutes}m must be <45m`,
          ),
        );
    }

    const pairs: { mono: Observation[]; split: Observation[] }[] = [];
    const bySource = new Map<string, Observation[]>();
    observations.forEach((record) =>
      bySource.set(record.sourceRunId, [...(bySource.get(record.sourceRunId) ?? []), record]),
    );
    for (const records of bySource.values()) {
      const mono = records.filter(
        ({ architectureVersion }) => architectureVersion === "monolithic",
      );
      const split = records.filter(
        ({ architectureVersion }) => architectureVersion === "shadow-split",
      );
      if (mono.length === 0 && split.length === 0) continue;
      if (mono.length === 0 || split.length === 0)
        fail(`source ${records[0]?.sourceRunId} has an incomplete shadow pair`);
      if (records.some(({ operationalFailure }) => operationalFailure)) continue;
      const identities = [
        "sourceSha",
        "profile",
        "manifestDigest",
        "inventoryDigest",
        "toolchainDigest",
        "inputDigest",
        "verificationExperimentId",
        "injectedFailure",
      ] as const;
      const monoAnchor = mono[0];
      const splitAnchor = split[0];
      if (!monoAnchor || !splitAnchor) fail("pair anchors are missing");
      for (const identity of identities)
        if (
          monoAnchor[identity] !== splitAnchor[identity] ||
          records.some((record) => record[identity] !== monoAnchor[identity])
        )
          fail(`source ${monoAnchor.sourceRunId} pair identity mismatch for ${identity}`);
      const left = architectureResults(mono);
      const right = architectureResults(split);
      assertInjectedFailureEvidence(mono);
      assertInjectedFailureEvidence(split);
      if (stable(left) !== stable(right))
        fail(`source ${monoAnchor.sourceRunId} monolith/split results are not equivalent`);
      if (monoAnchor.injectedFailure !== "none" && left.outcome !== "failure")
        fail(`source ${monoAnchor.sourceRunId} injected failure did not fail closed`);
      pairs.push({ mono, split });
    }
    pairs.sort(
      (left, right) =>
        Date.parse(left.mono[0]?.sourceCreatedAt ?? "") -
          Date.parse(right.mono[0]?.sourceCreatedAt ?? "") ||
        (left.mono[0]?.sourceRunId ?? "").localeCompare(right.mono[0]?.sourceRunId ?? ""),
    );
    const pairWindow = pairs.slice(-SAMPLE_WINDOW);
    const covered = [
      ...new Set(pairWindow.map(({ mono }) => mono[0]?.injectedFailure ?? "")),
    ].sort();
    if (pairWindow.length < SAMPLE_WINDOW)
      diagnostics.push(
        diagnostic(
          "INSUFFICIENT_EQUIVALENCE_PAIRS",
          `equivalence requires ${SAMPLE_WINDOW} complete pairs; found ${pairWindow.length}`,
        ),
      );
    if (
      !covered.includes("none") ||
      FAILURE_CLASSES.some((failureClass) => !covered.includes(failureClass))
    )
      diagnostics.push(
        diagnostic(
          "FAILURE_CLASS_COVERAGE_INCOMPLETE",
          "equivalence window must include a pass and all five injected failure classes",
        ),
      );
    let runnerCost: EvaluationReport["runnerCost"];
    if (pairWindow.length > 0) {
      const monolithicMedianMinutes =
        median(pairWindow.map(({ mono }) => architectureMetrics(mono).runner)) / MINUTE;
      const splitMedianMinutes =
        median(pairWindow.map(({ split }) => architectureMetrics(split).runner)) / MINUTE;
      const regression =
        monolithicMedianMinutes === 0 ? Infinity : splitMedianMinutes / monolithicMedianMinutes - 1;
      runnerCost = { monolithicMedianMinutes, splitMedianMinutes, regression };
      if (regression > 0.25)
        diagnostics.push(
          diagnostic(
            "RUNNER_COST_REGRESSION_EXCEEDED",
            `paired median runner-minute regression ${(regression * 100).toFixed(2)}% must be <=25%`,
          ),
        );
    }
    diagnostics.sort((left, right) =>
      `${left.code}/${left.key ?? ""}/${left.message}`.localeCompare(
        `${right.code}/${right.key ?? ""}/${right.message}`,
      ),
    );
    return {
      schemaVersion: REPORT_SCHEMA,
      mode: "promotion",
      cutoffAt: inventory.cutoffAt,
      observationCount: observations.length,
      failed: diagnostics.length > 0,
      diagnostics,
      cohorts: cohortReports,
      ...(primaryReport ? { primary: primaryReport } : {}),
      equivalence: { pairCount: pairWindow.length, coveredFailureClasses: covered },
      ...(runnerCost ? { runnerCost } : {}),
    };
  } catch (error) {
    return {
      schemaVersion: REPORT_SCHEMA,
      mode: options.contractOnly ? "contract-only" : "promotion",
      observationCount: 0,
      failed: true,
      diagnostics: [
        diagnostic("DATASET_INVALID", error instanceof Error ? error.message : String(error)),
      ],
      cohorts: {},
    };
  }
}

function readInputs(paths: readonly string[]): unknown {
  const files = paths.flatMap((path) =>
    statSync(resolve(path)).isDirectory()
      ? readdirSync(resolve(path))
          .filter((name) => name.endsWith(".json"))
          .sort()
          .map((name) => resolve(path, name))
      : [resolve(path)],
  );
  if (files.length === 0) fail("--input did not resolve any JSON files");
  const documents = files.map((file) => JSON.parse(readFileSync(file, "utf8")) as unknown);
  if (documents.length === 1) return documents[0];
  const inventoryDocuments = documents.filter(
    (document) => object(document, "input document").schemaVersion === INVENTORY_SCHEMA,
  );
  const observationDocuments = documents.filter(
    (document) => object(document, "input document").schemaVersion === OBSERVATION_SCHEMA,
  );
  if (
    inventoryDocuments.length !== 1 ||
    inventoryDocuments.length + observationDocuments.length !== documents.length
  )
    fail("multiple inputs require exactly one inventory document and observation documents only");
  return {
    schemaVersion: DATASET_SCHEMA,
    inventory: inventoryDocuments[0],
    observations: observationDocuments,
  };
}

function parseArguments(arguments_: readonly string[]): {
  inputs: string[];
  contractOnly: boolean;
  output?: string;
} {
  const inputs: string[] = [];
  let contractOnly = false;
  let output: string | undefined;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--contract-only") contractOnly = true;
    else if (argument === "--input") {
      const value = arguments_[index + 1];
      if (!value) fail("--input requires a path");
      inputs.push(value);
      index += 1;
    } else if (argument === "--output") {
      const value = arguments_[index + 1];
      if (!value) fail("--output requires a path");
      output = value;
      index += 1;
    } else fail(`unknown argument ${argument}`);
  }
  if (inputs.length === 0) fail("at least one --input path is required");
  return { inputs, contractOnly, ...(output ? { output } : {}) };
}

function main(): void {
  let report: EvaluationReport;
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    report = evaluateDataset(readInputs(arguments_.inputs), {
      contractOnly: arguments_.contractOnly,
    });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (arguments_.output) writeFileSync(resolve(arguments_.output), json);
    process.stdout.write(json);
  } catch (error) {
    report = {
      schemaVersion: REPORT_SCHEMA,
      mode: "promotion",
      observationCount: 0,
      failed: true,
      diagnostics: [
        diagnostic("CLI_INVALID", error instanceof Error ? error.message : String(error)),
      ],
      cohorts: {},
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  process.exitCode = report.failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
