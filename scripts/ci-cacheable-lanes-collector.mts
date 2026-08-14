#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  DATASET_SCHEMA,
  INVENTORY_SCHEMA,
  LANE_OWNERSHIP,
  OBSERVATION_SCHEMA,
  observationKey,
  parseDataset,
  parseObservation,
  RETENTION_DAYS,
  SECURITY_OWNERSHIP,
  type Dataset,
  type Observation,
  type OwnershipRecord,
} from "./ci-cacheable-lanes-evaluator.mts";

type PageResponse = {
  readonly total_count: number;
  readonly workflow_runs?: readonly unknown[];
  readonly artifacts?: readonly unknown[];
  readonly jobs?: readonly unknown[];
};

type WorkflowRun = {
  readonly id: number;
  readonly runAttempt: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: string;
};

type Artifact = {
  readonly name: string;
  readonly expired: boolean;
};

type Job = { readonly name: string };

export type CacheableCiCollectionClient = {
  readonly listWorkflowRuns: (workflow: string, page: number, createdRange: string) => PageResponse;
  readonly listRunArtifacts: (runId: number, page: number) => PageResponse;
  readonly listRunJobs: (runId: number, page: number) => PageResponse;
  readonly readArtifactJson: (runId: number, artifactName: string) => readonly unknown[];
};

export type CollectCacheableCiDatasetOptions = {
  readonly cutoffAt: string;
  readonly sourceWorkflow?: string;
  readonly observerWorkflow?: string;
};

type InventoryPage = Dataset["inventory"]["pages"][number];

type ExcludedSource = Dataset["inventory"]["excludedSources"][number];

const PRODUCER_JOB_NAMES = [
  "core-verification",
  "generated-apps",
  "package-artifacts",
  "coverage-security",
] as const;

const MAX_JSON_ARTIFACT_BYTES = 16 * 1024 * 1024;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${field} must be a non-empty string`);
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new Error(`${field} must be a non-negative integer`);
  return value as number;
}

function timestamp(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${field} must be an ISO timestamp`);
  return result;
}

function parseWorkflowRun(value: unknown, field: string): WorkflowRun {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  return {
    id: requiredNumber(value.id, `${field}.id`),
    runAttempt: requiredNumber(value.run_attempt, `${field}.run_attempt`),
    createdAt: timestamp(value.created_at, `${field}.created_at`),
    updatedAt: timestamp(value.updated_at, `${field}.updated_at`),
    status: requiredString(value.status, `${field}.status`),
  };
}

function parseArtifact(value: unknown, field: string): Artifact {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  if (typeof value.expired !== "boolean") throw new Error(`${field}.expired must be a boolean`);
  return { name: requiredString(value.name, `${field}.name`), expired: value.expired };
}

function parseJob(value: unknown, field: string): Job {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  return { name: requiredString(value.name, `${field}.name`) };
}

function pageItems(
  response: PageResponse,
  key: "workflow_runs" | "artifacts" | "jobs",
): readonly unknown[] {
  const items = response[key];
  if (!Array.isArray(items)) throw new Error(`GitHub response is missing ${key}`);
  return items;
}

function collectPages<T>(options: {
  readonly query: string;
  readonly load: (page: number) => PageResponse;
  readonly key: "workflow_runs" | "artifacts" | "jobs";
  readonly parse: (value: unknown, field: string) => T;
  readonly sourceRunIds?: (items: readonly T[]) => readonly string[];
  readonly artifactNames?: (items: readonly T[]) => readonly string[];
}): { readonly items: readonly T[]; readonly pages: readonly InventoryPage[] } {
  const items: T[] = [];
  const pages: InventoryPage[] = [];
  let pageNumber = 1;
  while (true) {
    const response = options.load(pageNumber);
    const responseTotal = requiredNumber(response.total_count, `${options.query}.total_count`);
    const rawItems = pageItems(response, options.key);
    const parsed = rawItems.map((value, index) =>
      options.parse(value, `${options.query}.page${pageNumber}[${index}]`),
    );
    const collectedAfterPage = items.length + parsed.length;
    if (parsed.length < 100 && collectedAfterPage < responseTotal)
      throw new Error(`${options.query} pagination ended before total_count was reached`);
    const hasNext = parsed.length === 100;
    pages.push({
      query: options.query,
      cursor: pageNumber === 1 ? null : String(pageNumber),
      nextCursor: hasNext ? String(pageNumber + 1) : null,
      totalCount: responseTotal,
      itemCount: parsed.length,
      sourceRunIds: options.sourceRunIds?.(parsed) ?? [],
      artifactNames: options.artifactNames?.(parsed) ?? [],
    });
    items.push(...parsed);
    if (!hasNext) break;
    if (parsed.length === 0)
      throw new Error(`${options.query} pagination ended before total_count was reached`);
    pageNumber += 1;
  }
  return { items, pages };
}

function performanceProfile(documents: readonly unknown[]): string {
  const samples = documents.filter(
    (document) =>
      isRecord(document) && document.schemaVersion === "croco.ci-performance-samples/v1",
  );
  if (samples.length !== 1) throw new Error("performance artifact must contain one raw sample");
  const currentSamples = samples[0]?.currentSamples;
  if (!Array.isArray(currentSamples) || currentSamples.length !== 1 || !isRecord(currentSamples[0]))
    throw new Error("performance artifact must contain exactly one current sample");
  return requiredString(currentSamples[0].profile, "performance current sample profile");
}

function expectedObservationKeys(run: WorkflowRun, jobs: readonly Job[]): readonly string[] {
  const names = jobs.map(({ name }) => name);
  const producerCount = PRODUCER_JOB_NAMES.filter((name) => names.includes(name)).length;
  if (producerCount !== 0 && producerCount !== PRODUCER_JOB_NAMES.length)
    throw new Error(`source run ${run.id} has an incomplete split producer set`);
  const prefix = `${run.id}/${run.runAttempt}`;
  if (producerCount === 0) {
    if (!names.includes("validate")) throw new Error(`source run ${run.id} is missing validate`);
    return [`${prefix}/monolithic/validate`];
  }
  const synthesisJob = names.includes("split-validation-shadow")
    ? "split-validation-shadow"
    : names.includes("validate")
      ? "validate"
      : undefined;
  if (!synthesisJob) throw new Error(`source run ${run.id} is missing split synthesis`);
  const architecture =
    synthesisJob === "split-validation-shadow" ? "shadow-split" : "cutover-split";
  const splitKeys = [
    ...PRODUCER_JOB_NAMES.map((name) => `${prefix}/${architecture}/${name}`),
    `${prefix}/${architecture}/${synthesisJob}`,
  ];
  return synthesisJob === "split-validation-shadow"
    ? [`${prefix}/monolithic/validate`, ...splitKeys]
    : splitKeys;
}

function ownership(): readonly OwnershipRecord[] {
  return Object.entries(LANE_OWNERSHIP).flatMap(([owner, ids]) =>
    ids.map((id) => ({
      id,
      owner,
      semantics: id === "core-coverage-warning" ? "advisory" : "blocking",
    })),
  );
}

function sourceRecord(run: WorkflowRun, reason: string): ExcludedSource {
  return {
    sourceRunId: String(run.id),
    sourceAttempt: run.runAttempt,
    createdAt: run.createdAt,
    reason,
  };
}

export function collectCacheableCiDataset(
  client: CacheableCiCollectionClient,
  options: CollectCacheableCiDatasetOptions,
): Dataset {
  const cutoffAt = timestamp(options.cutoffAt, "cutoffAt");
  const cutoff = Date.parse(cutoffAt);
  const windowStartedAt = new Date(cutoff - RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  const sourceWorkflow = options.sourceWorkflow ?? "ci.yml";
  const observerWorkflow = options.observerWorkflow ?? "ci-performance-observer.yml";
  const inventoryPages: InventoryPage[] = [];
  const sourceRunResult = collectPages({
    query: "source-runs",
    load: (page) =>
      client.listWorkflowRuns(sourceWorkflow, page, `${windowStartedAt}..${cutoffAt}`),
    key: "workflow_runs",
    parse: parseWorkflowRun,
    sourceRunIds: (runs) => runs.map(({ id }) => String(id)),
  });
  inventoryPages.push(...sourceRunResult.pages);
  const observerRunResult = collectPages({
    query: "observer-runs",
    load: (page) =>
      client.listWorkflowRuns(observerWorkflow, page, `${windowStartedAt}..${cutoffAt}`),
    key: "workflow_runs",
    parse: parseWorkflowRun,
  });
  inventoryPages.push(...observerRunResult.pages);

  const observationArtifacts = new Map<string, { runId: number; artifact: Artifact }[]>();
  for (const observerRun of observerRunResult.items) {
    if (observerRun.status !== "completed" || Date.parse(observerRun.updatedAt) > cutoff) continue;
    const result = collectPages({
      query: `observer-artifacts:${observerRun.id}`,
      load: (page) => client.listRunArtifacts(observerRun.id, page),
      key: "artifacts",
      parse: parseArtifact,
      artifactNames: (artifacts) => artifacts.map(({ name }) => name),
    });
    inventoryPages.push(...result.pages);
    for (const artifact of result.items) {
      if (!/^ci-observation-\d+-\d+$/.test(artifact.name)) continue;
      observationArtifacts.set(artifact.name, [
        ...(observationArtifacts.get(artifact.name) ?? []),
        { runId: observerRun.id, artifact },
      ]);
    }
  }

  const eligibleSources: Dataset["inventory"]["sources"][number][] = [];
  const excludedSources: ExcludedSource[] = [];
  const operationalSources: ExcludedSource[] = [];
  const observations: Observation[] = [];
  for (const sourceRun of sourceRunResult.items) {
    if (sourceRun.status !== "completed" || Date.parse(sourceRun.updatedAt) > cutoff) {
      operationalSources.push(sourceRecord(sourceRun, "source-run-not-completed-at-cutoff"));
      continue;
    }
    if (sourceRun.runAttempt !== 1) {
      operationalSources.push(sourceRecord(sourceRun, "source-run-is-not-first-attempt"));
      continue;
    }
    const artifactResult = collectPages({
      query: `source-artifacts:${sourceRun.id}`,
      load: (page) => client.listRunArtifacts(sourceRun.id, page),
      key: "artifacts",
      parse: parseArtifact,
      artifactNames: (artifacts) => artifacts.map(({ name }) => name),
    });
    inventoryPages.push(...artifactResult.pages);
    const performanceName = `ci-performance-${sourceRun.id}-${sourceRun.runAttempt}`;
    const performanceArtifacts = artifactResult.items.filter(
      ({ name }) => name === performanceName,
    );
    if (performanceArtifacts.length !== 1 || performanceArtifacts[0]?.expired) {
      operationalSources.push(
        sourceRecord(
          sourceRun,
          performanceArtifacts.length === 0
            ? "source-performance-artifact-missing"
            : performanceArtifacts.length > 1
              ? "source-performance-artifact-duplicate"
              : "source-performance-artifact-expired",
        ),
      );
      continue;
    }
    let profile: string;
    try {
      profile = performanceProfile(client.readArtifactJson(sourceRun.id, performanceName));
    } catch {
      operationalSources.push(sourceRecord(sourceRun, "source-performance-artifact-malformed"));
      continue;
    }
    if (profile !== "publish") {
      excludedSources.push(sourceRecord(sourceRun, `profile:${profile}`));
      continue;
    }
    const jobsResult = collectPages({
      query: `source-jobs:${sourceRun.id}`,
      load: (page) => client.listRunJobs(sourceRun.id, page),
      key: "jobs",
      parse: parseJob,
    });
    inventoryPages.push(...jobsResult.pages);
    const artifactName = `ci-observation-${sourceRun.id}-${sourceRun.runAttempt}`;
    const expectedRecordKeys = expectedObservationKeys(sourceRun, jobsResult.items);
    eligibleSources.push({
      sourceRunId: String(sourceRun.id),
      sourceAttempt: sourceRun.runAttempt,
      createdAt: sourceRun.createdAt,
      artifactName,
      expectedRecordKeys,
    });
    const candidates = observationArtifacts.get(artifactName) ?? [];
    if (candidates.length === 0) continue;
    if (candidates.length !== 1)
      throw new Error(`observer artifact ${artifactName} must be unique`);
    const candidate = candidates[0];
    if (!candidate || candidate.artifact.expired)
      throw new Error(`observer artifact ${artifactName} is expired`);
    const artifactObservations = client
      .readArtifactJson(candidate.runId, artifactName)
      .filter((document) => isRecord(document) && document.schemaVersion === OBSERVATION_SCHEMA)
      .map((document, index) => parseObservation(document, `${artifactName}[${index}]`));
    const actualKeys = artifactObservations.map(observationKey).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify([...expectedRecordKeys].sort()))
      throw new Error(`observer artifact ${artifactName} record keys do not match source jobs`);
    if (
      artifactObservations.some(
        (observation) =>
          observation.sourceRunId !== String(sourceRun.id) ||
          observation.sourceAttempt !== sourceRun.runAttempt ||
          observation.artifactName !== artifactName,
      )
    )
      throw new Error(`observer artifact ${artifactName} provenance does not match the source run`);
    observations.push(...artifactObservations);
  }

  const latestObservation = [...observations].sort(
    (left, right) => Date.parse(right.sourceCreatedAt) - Date.parse(left.sourceCreatedAt),
  )[0];
  if (!latestObservation)
    throw new Error("collection contains no provenance-valid publish observations");
  const dataset: Dataset = {
    schemaVersion: DATASET_SCHEMA,
    inventory: {
      schemaVersion: INVENTORY_SCHEMA,
      cutoffAt,
      windowStartedAt,
      retentionDays: RETENTION_DAYS,
      sourceRunCount: sourceRunResult.items.length,
      eligibleSourceCount: eligibleSources.length,
      artifactCount: [...observationArtifacts.values()].reduce(
        (count, candidates) => count + candidates.length,
        0,
      ),
      pages: inventoryPages,
      cohort: {
        profile: "publish",
        runnerOs: latestObservation.runnerOs,
        runnerArch: "X64",
        runnerLabel: "ubuntu-latest",
        nodeVersion: latestObservation.nodeVersion,
        pnpmVersion: latestObservation.pnpmVersion,
        turboVersion: latestObservation.turboVersion,
        toolchainDigest: latestObservation.toolchainDigest,
      },
      ownership: { manifest: ownership(), security: [...SECURITY_OWNERSHIP] },
      sources: eligibleSources,
      excludedSources,
      operationalSources,
    },
    observations,
  };
  return parseDataset(dataset);
}

function jsonFiles(directory: string): readonly string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    const currentStat = lstatSync(current);
    if (currentStat.isSymbolicLink())
      throw new Error(`artifact contains a symbolic link: ${current}`);
    if (currentStat.isDirectory()) {
      for (const entry of readdirSync(current)) visit(join(current, entry));
      return;
    }
    if (!currentStat.isFile())
      throw new Error(`artifact contains an unsupported entry: ${current}`);
    if (current.endsWith(".json")) files.push(current);
  };
  visit(directory);
  return files.sort();
}

function githubClient(repository: string): CacheableCiCollectionClient {
  const ghJson = (endpoint: string): PageResponse =>
    JSON.parse(
      execFileSync(
        "gh",
        [
          "api",
          "--method",
          "GET",
          "-H",
          "Accept: application/vnd.github+json",
          "-H",
          "X-GitHub-Api-Version: 2022-11-28",
          endpoint,
        ],
        { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
      ),
    ) as PageResponse;
  return {
    listWorkflowRuns: (workflow, page, createdRange) =>
      ghJson(
        `/repos/${repository}/actions/workflows/${workflow}/runs?created=${encodeURIComponent(createdRange)}&per_page=100&page=${page}`,
      ),
    listRunArtifacts: (runId, page) =>
      ghJson(`/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`),
    listRunJobs: (runId, page) =>
      ghJson(
        `/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`,
      ),
    readArtifactJson: (runId, artifactName) => {
      const directory = mkdtempSync(join(tmpdir(), "croco-ci-observation-"));
      try {
        execFileSync(
          "gh",
          [
            "run",
            "download",
            String(runId),
            "--repo",
            repository,
            "--name",
            artifactName,
            "--dir",
            directory,
          ],
          { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
        );
        return jsonFiles(directory).map((file) => {
          const fileStat = lstatSync(file);
          if (fileStat.size > MAX_JSON_ARTIFACT_BYTES)
            throw new Error(
              `artifact JSON exceeds ${MAX_JSON_ARTIFACT_BYTES} bytes: ${basename(file)}`,
            );
          return JSON.parse(readFileSync(file, "utf8")) as unknown;
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  };
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index === -1 ? undefined : arguments_[index + 1];
}

function requiredOption(arguments_: readonly string[], name: string): string {
  const value = optionValue(arguments_, name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return value;
}

function writeDataset(output: string, dataset: Dataset): void {
  const root = resolve(process.cwd());
  const outputDirectory = resolve(output);
  const outputRelative = relative(root, outputDirectory);
  if (
    outputRelative.length === 0 ||
    outputRelative === ".." ||
    outputRelative.startsWith(`..${sep}`)
  )
    throw new Error("--output must be a repository-relative child directory");
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    join(outputDirectory, "inventory.json"),
    `${JSON.stringify(dataset.inventory, null, 2)}\n`,
  );
  dataset.observations.forEach((observation, index) =>
    writeFileSync(
      join(
        outputDirectory,
        `observation-${String(index + 1).padStart(4, "0")}-${observation.sourceRunId}-${observation.architectureVersion}-${observation.jobIdentity}.json`,
      ),
      `${JSON.stringify(observation, null, 2)}\n`,
    ),
  );
}

function main(arguments_: readonly string[]): void {
  const repository = optionValue(arguments_, "--repo") ?? process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("Missing --repo and GITHUB_REPOSITORY");
  const cutoffAt = optionValue(arguments_, "--cutoff-at") ?? new Date().toISOString();
  const output = requiredOption(arguments_, "--output");
  const dataset = collectCacheableCiDataset(githubClient(repository), { cutoffAt });
  writeDataset(output, dataset);
  process.stdout.write(
    `[ci-cacheable-lanes-collector] sources=${dataset.inventory.sourceRunCount} eligible=${dataset.inventory.eligibleSourceCount} observations=${dataset.observations.length} output=${resolve(output)}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `[ci-cacheable-lanes-collector] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
