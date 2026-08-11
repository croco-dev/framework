import { Problem, ProblemCategory } from "@croco/problems-core";

import type {
  AssuranceBehaviorNode,
  AssuranceSourceLocation,
  ExecutableAssuranceGraph,
} from "./executable-assurance.mjs";
import type { TestEvidenceBundle, TestEvidenceRecord } from "./test-evidence.mjs";

export const CHANGED_TEST_PLAN_VERSION = "croco.changed-test-plan/v1" as const;
export const CHANGED_TEST_SELECTION_BASELINE_VERSION =
  "croco.changed-test-selection-baseline/v1" as const;

export type ChangedTestFallback = {
  readonly profile: "full";
  readonly reason: string;
  readonly paths: readonly string[];
};

export type ChangedTestSelectionReason = {
  readonly testId: string;
  readonly contractId: string;
  readonly reason: string;
  readonly command: readonly string[];
};

export type ChangedTestExclusion = {
  readonly testId: string;
  readonly reason: string;
};

export type ChangedTestSource = AssuranceSourceLocation & {
  readonly contractId: string;
};

export type ChangedTestSuite = {
  readonly profile: "full";
  readonly command: readonly string[];
  readonly reason: string;
};

export type ChangedTestPlan = {
  readonly schemaVersion: typeof CHANGED_TEST_PLAN_VERSION;
  readonly mode: "shadow" | "enforce";
  readonly base: string;
  readonly head: string;
  readonly changedContracts: readonly string[];
  readonly selectedTests: readonly string[];
  readonly selectedSuites: readonly ChangedTestSuite[];
  readonly requiredEvidence: readonly string[];
  readonly selectionReasons: readonly ChangedTestSelectionReason[];
  readonly excludedTests: readonly ChangedTestExclusion[];
  readonly fallbacks: readonly ChangedTestFallback[];
  readonly commands: readonly (readonly string[])[];
  readonly sourceLocations: readonly ChangedTestSource[];
  readonly budget: {
    readonly limitMs: number | null;
    readonly estimatedMs: number;
    readonly unknownDurationTests: readonly string[];
    readonly overflowMs: number;
  };
  readonly incomplete: boolean;
};

export type ChangedTestPlanInput = {
  readonly base: string;
  readonly head?: string;
  readonly baseGraph?: ExecutableAssuranceGraph;
  readonly headGraph?: ExecutableAssuranceGraph;
  readonly evidence?: TestEvidenceBundle;
  readonly changedFiles: readonly string[];
  readonly budgetMs?: number;
  readonly mode?: "shadow" | "enforce";
};

export type ChangedTestSelectionBaseline = {
  readonly schemaVersion: typeof CHANGED_TEST_SELECTION_BASELINE_VERSION;
  readonly observationWindow: number;
  readonly missThreshold: number;
  readonly observedRuns: number;
  readonly selectionMisses: number;
  readonly missRate: number;
  readonly eligibleForEnforcement: boolean;
  readonly runs: readonly {
    readonly base: string;
    readonly head: string;
    readonly selectedTests: number;
    readonly fullTests: number;
    readonly missedTests: readonly string[];
    readonly complete: boolean;
  }[];
};

/** Represents invalid changed-test planner input or execution conditions. */
export class ChangedTestPlanProblem extends Problem {
  readonly code = "CROCO_CHANGED_TEST_PLAN_INVALID";

  constructor(detail: string, cause?: Error) {
    super(
      "CROCO_CHANGED_TEST_PLAN_INVALID",
      ProblemCategory.ValidationError,
      `CROCO_CHANGED_TEST_PLAN_INVALID: ${detail}`,
      cause ? { cause } : undefined,
    );
    this.name = "ChangedTestPlanProblem";
  }
}

export function assertChangedTestSelectionBaseline(
  value: unknown,
  label = "changed-test baseline",
): asserts value is ChangedTestSelectionBaseline {
  if (!isRecord(value)) {
    throw new ChangedTestPlanProblem(`Invalid ${label}: expected an object.`);
  }
  const runs = value["runs"];
  const validRuns =
    Array.isArray(runs) &&
    runs.every(
      (run) =>
        isRecord(run) &&
        typeof run["base"] === "string" &&
        run["base"].trim().length > 0 &&
        typeof run["head"] === "string" &&
        run["head"].trim().length > 0 &&
        isNonNegativeInteger(run["selectedTests"]) &&
        isNonNegativeInteger(run["fullTests"]) &&
        Array.isArray(run["missedTests"]) &&
        run["missedTests"].every((test) => typeof test === "string") &&
        typeof run["complete"] === "boolean",
    );
  if (
    value["schemaVersion"] !== CHANGED_TEST_SELECTION_BASELINE_VERSION ||
    !isPositiveInteger(value["observationWindow"]) ||
    typeof value["missThreshold"] !== "number" ||
    !Number.isFinite(value["missThreshold"]) ||
    value["missThreshold"] < 0 ||
    value["missThreshold"] > 1 ||
    !isNonNegativeInteger(value["observedRuns"]) ||
    !isNonNegativeInteger(value["selectionMisses"]) ||
    typeof value["missRate"] !== "number" ||
    !Number.isFinite(value["missRate"]) ||
    value["missRate"] < 0 ||
    value["missRate"] > 1 ||
    typeof value["eligibleForEnforcement"] !== "boolean" ||
    !validRuns ||
    runs.length > value["observationWindow"]
  ) {
    throw new ChangedTestPlanProblem(`Invalid ${label}: artifact does not match the v1 schema.`);
  }
}

export function createChangedTestPlan(input: ChangedTestPlanInput): ChangedTestPlan {
  assertPlanInput(input);
  const evidence = input.evidence?.records ?? [];
  const changedFiles = uniqueStrings(input.changedFiles);
  const fallbacks = classifyFallbacks(changedFiles, input.baseGraph, input.headGraph);
  const changedNodes = changedBehaviorNodes(input.baseGraph, input.headGraph);
  const changedContracts = changedContractIds(input.baseGraph, input.headGraph, changedNodes);
  const currentObligations = input.headGraph?.obligations ?? [];
  const requiredEvidence = uniqueStrings(
    currentObligations
      .filter(
        (obligation) =>
          changedContracts.some((id) => contractsRelated(id, obligation.behaviorId)) ||
          changedNodes.has(obligation.nodeId),
      )
      .map(({ behaviorId }) => behaviorId),
  );
  const selections = selectEvidence(evidence, changedContracts, fallbacks);
  const selectedIds = new Set(selections.map(({ record }) => record.id));
  const missingObligations = currentObligations.filter(
    (obligation) =>
      requiredEvidence.includes(obligation.behaviorId) &&
      !selections.some(({ record }) => recordDeclares(record, obligation.behaviorId)),
  );
  const selectedSuites = fallbackSuites(fallbacks);
  const commands = uniqueCommands(
    selectedSuites.length > 0
      ? selectedSuites.map(({ command }) => command)
      : [
          ...selections.map(({ record }) => replayCommand(record)),
          ...missingObligations.map(({ recovery }) => shellCommand(recovery.command)),
        ],
  );
  const estimatedMs = selections.reduce(
    (total, { record }) => total + (record.timing?.durationMs ?? 0),
    0,
  );
  const unknownDurationTests = selections
    .filter(({ record }) => record.timing?.durationMs === undefined)
    .map(({ record }) => record.id)
    .sort(compareStrings);
  const limitMs = input.budgetMs ?? null;
  const overflowMs = limitMs === null ? 0 : Math.max(0, estimatedMs - limitMs);

  return deepFreeze({
    schemaVersion: CHANGED_TEST_PLAN_VERSION,
    mode: input.mode ?? "shadow",
    base: input.base,
    head: input.head ?? "HEAD",
    changedContracts,
    selectedTests: [...selectedIds].sort(compareStrings),
    selectedSuites,
    requiredEvidence,
    selectionReasons: selections
      .map(({ record, contractId, reason }) => ({
        testId: record.id,
        contractId,
        reason,
        command: replayCommand(record),
      }))
      .sort((left, right) =>
        compareStrings(`${left.testId}:${left.contractId}`, `${right.testId}:${right.contractId}`),
      ),
    excludedTests: evidence
      .filter(({ id }) => !selectedIds.has(id) && selectedSuites.length === 0)
      .map(({ id }) => ({
        testId: id,
        reason:
          changedContracts.length === 0
            ? "No assurance contract changed."
            : "The test declares and observes no changed assurance contract.",
      }))
      .sort((left, right) => compareStrings(left.testId, right.testId)),
    fallbacks,
    commands,
    sourceLocations: sourceLocations(changedNodes),
    budget: {
      limitMs,
      estimatedMs,
      unknownDurationTests,
      overflowMs,
    },
    incomplete:
      overflowMs > 0 ||
      (limitMs !== null && unknownDurationTests.length > 0) ||
      missingObligations.length > 0,
  });
}

export function updateChangedTestSelectionBaseline(
  plan: ChangedTestPlan,
  fullEvidence: TestEvidenceBundle,
  options: {
    readonly previous?: ChangedTestSelectionBaseline;
    readonly observationWindow: number;
    readonly missThreshold: number;
  },
): ChangedTestSelectionBaseline {
  if (options.previous) assertChangedTestSelectionBaseline(options.previous);
  assertPositiveInteger(options.observationWindow, "Observation window");
  if (
    !Number.isFinite(options.missThreshold) ||
    options.missThreshold < 0 ||
    options.missThreshold > 1
  ) {
    throw new ChangedTestPlanProblem("Miss threshold must be a number from 0 through 1.");
  }
  const selected = new Set(plan.selectedTests);
  const fullSuiteSelected = plan.selectedSuites.some(({ profile }) => profile === "full");
  const fullSuiteStatus = fullEvidence.records.find(
    ({ id }) => id === "croco.changed-test-full-suite-status",
  );
  const fullTestsObserved = fullEvidence.records.filter(
    ({ id }) => id !== "croco.changed-test-full-suite-status",
  ).length;
  const complete =
    fullTestsObserved > 0 &&
    fullEvidence.missingArtifacts.length === 0 &&
    fullEvidence.status === "passed" &&
    fullSuiteStatus?.outcome === "passed";
  const missedTests = fullEvidence.records
    .filter(({ id, outcome }) => outcome === "failed" && !fullSuiteSelected && !selected.has(id))
    .map(({ id }) => id)
    .sort(compareStrings);
  const previousRuns = options.previous?.runs ?? [];
  const runs = [
    ...previousRuns,
    {
      base: plan.base,
      head: plan.head,
      selectedTests: plan.selectedTests.length,
      fullTests: fullTestsObserved,
      missedTests,
      complete,
    },
  ].slice(-options.observationWindow);
  const observedRuns = (options.previous?.observedRuns ?? 0) + (complete ? 1 : 0);
  const selectionMisses = (options.previous?.selectionMisses ?? 0) + missedTests.length;
  const fullTests = runs.reduce((total, run) => total + run.fullTests, 0);
  const windowMisses = runs.reduce((total, run) => total + run.missedTests.length, 0);
  const missRate = fullTests === 0 ? 0 : windowMisses / fullTests;

  return deepFreeze({
    schemaVersion: CHANGED_TEST_SELECTION_BASELINE_VERSION,
    observationWindow: options.observationWindow,
    missThreshold: options.missThreshold,
    observedRuns,
    selectionMisses,
    missRate,
    eligibleForEnforcement:
      observedRuns >= options.observationWindow &&
      runs.length === options.observationWindow &&
      missRate <= options.missThreshold &&
      runs.every((run) => run.complete),
    runs,
  });
}

export function assertChangedTestPlanEnforceable(baseline: ChangedTestSelectionBaseline): void {
  if (baseline.observedRuns < baseline.observationWindow) {
    throw new ChangedTestPlanProblem(
      `Enforcement requires ${baseline.observationWindow} observed run(s); only ${baseline.observedRuns} are recorded.`,
    );
  }
  if (baseline.missRate > baseline.missThreshold) {
    throw new ChangedTestPlanProblem(
      `Enforcement requires a miss rate at or below ${baseline.missThreshold}; the observed rate is ${baseline.missRate}.`,
    );
  }
  if (!baseline.eligibleForEnforcement) {
    throw new ChangedTestPlanProblem(
      "Enforcement requires complete non-empty full-suite evidence for every run in the observation window.",
    );
  }
}

export function serializeChangedTestPlan(
  value: ChangedTestPlan | ChangedTestSelectionBaseline,
): string {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`;
}

function changedBehaviorNodes(
  baseGraph: ExecutableAssuranceGraph | undefined,
  headGraph: ExecutableAssuranceGraph | undefined,
): ReadonlyMap<string, AssuranceBehaviorNode> {
  const base = new Map((baseGraph?.nodes ?? []).map((node) => [node.id, node]));
  const head = new Map((headGraph?.nodes ?? []).map((node) => [node.id, node]));
  const changed = new Map<string, AssuranceBehaviorNode>();
  for (const id of new Set([...base.keys(), ...head.keys()])) {
    const before = base.get(id);
    const after = head.get(id);
    if (canonicalString(before) !== canonicalString(after)) {
      changed.set(id, after ?? before ?? unreachableNode(id));
    }
  }
  return changed;
}

function changedContractIds(
  baseGraph: ExecutableAssuranceGraph | undefined,
  headGraph: ExecutableAssuranceGraph | undefined,
  nodes: ReadonlyMap<string, AssuranceBehaviorNode>,
): readonly string[] {
  const ids = [...nodes.keys()];
  const base = new Map(
    (baseGraph?.obligations ?? []).map((obligation) => [obligation.id, obligation]),
  );
  const head = new Map(
    (headGraph?.obligations ?? []).map((obligation) => [obligation.id, obligation]),
  );
  for (const id of new Set([...base.keys(), ...head.keys()])) {
    const before = base.get(id);
    const after = head.get(id);
    if (canonicalString(before) !== canonicalString(after)) {
      if (before) ids.push(before.behaviorId);
      if (after) ids.push(after.behaviorId);
    }
  }
  return uniqueStrings(ids);
}

function selectEvidence(
  records: readonly TestEvidenceRecord[],
  changedContracts: readonly string[],
  fallbacks: readonly ChangedTestFallback[],
): readonly {
  readonly record: TestEvidenceRecord;
  readonly contractId: string;
  readonly reason: string;
}[] {
  const fullFallback = fallbacks.some(({ profile }) => profile === "full");
  const selected: {
    record: TestEvidenceRecord;
    contractId: string;
    reason: string;
  }[] = [];
  for (const record of records) {
    if (fullFallback) {
      selected.push({
        record,
        contractId: "fallback:full",
        reason:
          "Selected because an unsupported or shared-boundary change widened the plan to the full profile.",
      });
      continue;
    }
    const matching = recordContractIds(record).find((recordId) =>
      changedContracts.some((changedId) => contractsRelated(recordId, changedId)),
    );
    if (matching) {
      selected.push({
        record,
        contractId: matching,
        reason: `Selected because '${matching}' intersects a changed assurance contract.`,
      });
    }
  }
  return selected;
}

function recordContractIds(record: TestEvidenceRecord): readonly string[] {
  return uniqueStrings([
    ...record.intent.contractIds,
    ...record.observed.contractIds,
    ...(record.observed.routeIds ?? []).map((id) => `route:${id}`),
    ...(record.observed.problemCodes ?? []).map((id) => `problem:${id}`),
    ...(record.observed.eventIds ?? []).map((id) => `event:${id}`),
    ...(record.observed.taskIds ?? []).map((id) => `task:${id}`),
    ...(record.observed.providerIds ?? []).map((id) => `provider:${id}`),
  ]);
}

function classifyFallbacks(
  files: readonly string[],
  baseGraph: ExecutableAssuranceGraph | undefined,
  headGraph: ExecutableAssuranceGraph | undefined,
): readonly ChangedTestFallback[] {
  const infrastructure = files.filter((path) =>
    /^(?:\.github\/workflows\/|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|turbo\.json$|tsconfig(?:\.[^/]+)?\.json$|scripts\/|packages\/(?:testing|cli|protocols-core|framework-context)\/|(?:apps|examples|packages)\/[^/]+\/(?:package\.json|tsconfig(?:\.[^/]+)?\.json)$)/.test(
      path,
    ),
  );
  const generated = files.filter((path) =>
    /(?:^|\/)(?:generated|codegen|rpc-codegen|openapi-spec|create-croco-app)(?:\/|$)/.test(path),
  );
  const sharedRuntime = files.filter((path) =>
    /^packages\/(?:problems-core|events-core|telemetry-api|transports-http)\//.test(path),
  );
  const classified = new Set([...infrastructure, ...generated, ...sharedRuntime]);
  const unknown = files.filter(
    (path) =>
      !classified.has(path) &&
      !/^(?:apps|examples|packages)\/[^/]+\//.test(path) &&
      !/^(?:docs\/|\.changeset\/|README\.md$)/.test(path),
  );
  const fallbacks: ChangedTestFallback[] = [];
  if (!baseGraph || !headGraph) {
    fallbacks.push({
      profile: "full",
      reason:
        "The base or head Executable Assurance Graph is unavailable, so graph edges cannot be proven complete.",
      paths: [],
    });
  }
  if (infrastructure.length > 0 || generated.length > 0 || sharedRuntime.length > 0) {
    fallbacks.push({
      profile: "full",
      reason:
        "Testing infrastructure, code generation, TypeScript/build configuration, verification policy, or a shared runtime boundary changed.",
      paths: uniqueStrings([...infrastructure, ...generated, ...sharedRuntime]),
    });
  }
  if (unknown.length > 0) {
    fallbacks.push({
      profile: "full",
      reason: "Unknown or unsupported changed paths require conservative full-profile execution.",
      paths: unknown,
    });
  }
  const packagePaths = files.filter((path) => /^(?:apps|examples|packages)\/[^/]+\//.test(path));
  if (fallbacks.length === 0 && packagePaths.length > 0) {
    fallbacks.push({
      profile: "full",
      reason:
        "Package dependency edges are not present in the Executable Assurance Graph, so dependent package coverage cannot be proven.",
      paths: packagePaths,
    });
  }
  return fallbacks.sort((left, right) => compareStrings(left.profile, right.profile));
}

function fallbackSuites(fallbacks: readonly ChangedTestFallback[]): readonly ChangedTestSuite[] {
  const full = fallbacks.find(({ profile }) => profile === "full");
  return full ? [{ profile: "full", command: ["pnpm", "test"], reason: full.reason }] : [];
}

function sourceLocations(
  nodes: ReadonlyMap<string, AssuranceBehaviorNode>,
): readonly ChangedTestSource[] {
  return [...nodes.values()]
    .filter((node): node is AssuranceBehaviorNode & { readonly source: AssuranceSourceLocation } =>
      Boolean(node.source),
    )
    .map((node) => ({ contractId: node.id, ...node.source }))
    .sort((left, right) =>
      compareStrings(`${left.path}:${left.contractId}`, `${right.path}:${right.contractId}`),
    );
}

function replayCommand(record: TestEvidenceRecord): readonly string[] {
  return shellCommand(record.replay.command);
}

function shellCommand(command: string): readonly string[] {
  return ["sh", "-c", command];
}

function uniqueCommands(commands: readonly (readonly string[])[]): readonly (readonly string[])[] {
  const byCommand = new Map(commands.map((command) => [JSON.stringify(command), command]));
  return [...byCommand.values()].sort((left, right) =>
    compareStrings(JSON.stringify(left), JSON.stringify(right)),
  );
}

function recordDeclares(record: TestEvidenceRecord, behaviorId: string): boolean {
  return record.intent.contractIds.includes(behaviorId);
}

function contractsRelated(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}#`) || right.startsWith(`${left}#`);
}

function assertPlanInput(input: ChangedTestPlanInput): void {
  if (!input.base.trim()) throw new ChangedTestPlanProblem("Base revision must not be empty.");
  if (input.budgetMs !== undefined && (!Number.isFinite(input.budgetMs) || input.budgetMs < 0)) {
    throw new ChangedTestPlanProblem(
      "Budget must be a non-negative finite number of milliseconds.",
    );
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ChangedTestPlanProblem(`${label} must be a positive integer.`);
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, nested]) => [key, canonicalizeJson(nested)]),
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function unreachableNode(id: string): AssuranceBehaviorNode {
  throw new ChangedTestPlanProblem(`Unable to resolve changed behavior node '${id}'.`);
}
