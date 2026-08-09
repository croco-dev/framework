import { Problem, ProblemCategory, type ProblemDetails } from "@croco/problems-core";

import { redactTestEvidence } from "./test-evidence.mjs";
import { TestRuntime, type TestDuration } from "./TestRuntime";

export const SCENARIO_REPORT_SCHEMA_VERSION = "croco.scenario-report/v1" as const;

const SCENARIO_BOUNDARIES: readonly ScenarioBoundary[] = [
  "event",
  "provider",
  "retry",
  "task",
  "telemetry",
  "transaction",
  "trigger",
];

const SCENARIO_FAILURE_KINDS: readonly ScenarioFailureKind[] = [
  "duplicate-delivery",
  "exporter-failure",
  "lost-response",
  "process-interruption",
  "retryable-failure",
  "terminal-failure",
  "timeout",
];

export type ScenarioBoundary =
  | "event"
  | "provider"
  | "retry"
  | "task"
  | "telemetry"
  | "transaction"
  | "trigger";

export type ScenarioEvidenceKind =
  | "audit"
  | "diagnostic"
  | "event"
  | "recovery"
  | "task"
  | "telemetry";

export type ScenarioEvidence = {
  readonly kind: ScenarioEvidenceKind;
  readonly name: string;
};

export type ScenarioExpectation = ScenarioEvidence & {
  readonly count: number;
};

export type ScenarioFailureKind =
  | "duplicate-delivery"
  | "exporter-failure"
  | "lost-response"
  | "process-interruption"
  | "retryable-failure"
  | "terminal-failure"
  | "timeout";

type ScenarioFailureBase = {
  readonly kind: ScenarioFailureKind;
};

export type ScenarioDuplicateDelivery = ScenarioFailureBase & {
  readonly deliveries: number;
  readonly kind: "duplicate-delivery";
};

export type ScenarioProblemFailure = ScenarioFailureBase & {
  readonly kind: Exclude<ScenarioFailureKind, "duplicate-delivery">;
  readonly occurrences: number;
  readonly problem: Problem;
  readonly virtualTimeAdvance?: TestDuration;
};

export type ScenarioFailure = ScenarioDuplicateDelivery | ScenarioProblemFailure;

export type ScenarioReplayDuplicateDelivery = {
  readonly boundary: ScenarioBoundary;
  readonly deliveries: number;
  readonly kind: "duplicate-delivery";
  readonly point: string;
};

export type ScenarioReplayProblemFailure = {
  readonly boundary: ScenarioBoundary;
  readonly kind: Exclude<ScenarioFailureKind, "duplicate-delivery">;
  readonly occurrences: number;
  readonly point: string;
  readonly problem: ScenarioReplayProblemDetails;
  readonly virtualTimeAdvanceMs?: number;
};

export type ScenarioReplayFailure = ScenarioReplayDuplicateDelivery | ScenarioReplayProblemFailure;

export type ScenarioReplayProblemDetails = ProblemDetails & {
  readonly category: ProblemCategory;
};

export type ScenarioReplayMetadata = {
  readonly initialTime: string;
  readonly scenarioId: string;
  readonly seed: string;
  readonly timeline: readonly ScenarioReplayFailure[];
  readonly virtualTime: string;
};

export type ScenarioTimelineEntry = {
  readonly at: string;
  readonly boundary?: ScenarioBoundary;
  readonly failure?: ScenarioFailureKind;
  readonly kind: "boundary" | "evidence" | "failure" | "time";
  readonly name: string;
  readonly sequence: number;
};

export type ScenarioReport = {
  readonly evidence: readonly ScenarioEvidence[];
  readonly problems: readonly ProblemDetails[];
  readonly replay: ScenarioReplayMetadata;
  readonly schemaVersion: typeof SCENARIO_REPORT_SCHEMA_VERSION;
  readonly status: "passed";
  readonly timeline: readonly ScenarioTimelineEntry[];
};

export type ScenarioRuntimeOptions = {
  readonly initialTime?: Date | string;
  readonly scenarioId: string;
  readonly seed?: string;
};

type PlannedFailure = {
  readonly boundary: ScenarioBoundary;
  readonly failure: ScenarioFailure;
  readonly point: string;
  remaining: number;
};

/** Concrete Problem for `testing/scenario-contract-invalid` scenario validation failures. */
export class ScenarioContractProblem extends Problem {
  constructor(detail: string, cause?: Error) {
    super(
      "testing/scenario-contract-invalid",
      ProblemCategory.ValidationError,
      detail,
      cause ? { cause } : undefined,
    );
  }
}

class ReplayedScenarioProblem extends Problem {
  private readonly details: ProblemDetails;

  constructor(replayDetails: ScenarioReplayProblemDetails) {
    const { category, ...details } = replayDetails;
    const extensions = Object.fromEntries(
      Object.entries(details).filter(
        ([key]) => !["code", "detail", "instance", "status", "title", "type"].includes(key),
      ),
    );
    super(details.code, category, details.detail, {
      type: details.type,
      ...(details.instance === undefined ? {} : { instance: details.instance }),
      ...(Object.keys(extensions).length === 0 ? {} : { extensions }),
    });
    this.details = details;
  }

  override get status(): number {
    return this.details.status;
  }

  override get title(): string {
    return this.details.title;
  }

  override toJSON(): ProblemDetails {
    return normalizeProblemDetails(this.details);
  }
}

export function duplicateDelivery(deliveries = 2): ScenarioDuplicateDelivery {
  assertPositiveSafeInteger(deliveries, "duplicate delivery count");
  return { deliveries, kind: "duplicate-delivery" };
}

export function loseResponse(problem: Problem): ScenarioProblemFailure {
  return problemFailure("lost-response", problem);
}

export function timeout(
  problem: Problem,
  virtualTimeAdvance: TestDuration,
): ScenarioProblemFailure {
  return problemFailure("timeout", problem, { virtualTimeAdvance });
}

export function retryableFailure(problem: Problem, occurrences = 1): ScenarioProblemFailure {
  return problemFailure("retryable-failure", problem, { occurrences });
}

export function terminalFailure(problem: Problem): ScenarioProblemFailure {
  return problemFailure("terminal-failure", problem);
}

export function interruptProcess(problem: Problem): ScenarioProblemFailure {
  return problemFailure("process-interruption", problem);
}

export function failExporter(problem: Problem): ScenarioProblemFailure {
  return problemFailure("exporter-failure", problem);
}

export function createScenarioRuntime(options: ScenarioRuntimeOptions): ScenarioRuntime {
  return new ScenarioRuntime(options);
}

export class ScenarioRuntime {
  readonly controls: TestRuntime;
  private readonly evidence: ScenarioEvidence[] = [];
  private readonly expectations: ScenarioExpectation[] = [];
  private readonly expectedProblems: { readonly code: string; readonly count: number }[] = [];
  private readonly initialTime: string;
  private executionDepth = 0;
  private readonly planned: PlannedFailure[] = [];
  private readonly problems: ProblemDetails[] = [];
  private propagatingInjectedProblem: Problem | undefined;
  private readonly replayTimeline: ScenarioReplayFailure[] = [];
  private readonly timeline: ScenarioTimelineEntry[] = [];

  constructor(options: ScenarioRuntimeOptions) {
    assertNonEmpty(options.scenarioId, "scenario ID");
    if (options.seed !== undefined) {
      assertNonEmpty(options.seed, "scenario seed");
    }
    const initialTime = options.initialTime ?? "2026-01-01T00:00:00.000Z";
    this.controls = new TestRuntime({
      clock: initialTime,
      ids: options.seed ?? options.scenarioId,
      scenarioId: options.scenarioId,
    });
    this.initialTime = this.controls.clock.now.toISOString();
  }

  at(point: string, boundary: ScenarioBoundary, failure: ScenarioFailure): this {
    assertNonEmpty(point, "failure point");
    const remaining = failure.kind === "duplicate-delivery" ? 1 : failure.occurrences;
    this.planned.push({ boundary, failure, point, remaining });
    this.replayTimeline.push(toReplayFailure(point, boundary, failure));
    return this;
  }

  expectProblem(code: string, count = 1): this {
    assertNonEmpty(code, "expected Problem code");
    assertPositiveSafeInteger(count, "expected Problem count");
    this.expectedProblems.push({ code, count });
    return this;
  }

  expectEvidence(kind: ScenarioEvidenceKind, name: string, count = 1): this {
    assertNonEmpty(name, `expected ${kind} evidence name`);
    assertPositiveSafeInteger(count, `expected ${kind} evidence count`);
    this.expectations.push({ count, kind, name });
    return this;
  }

  expectEventOnce(name: string): this {
    return this.expectEvidence("event", name);
  }

  expectTask(name: string, count = 1): this {
    return this.expectEvidence("task", name, count);
  }

  recordEvidence(kind: ScenarioEvidenceKind, name: string): void {
    assertNonEmpty(name, `${kind} evidence name`);
    this.evidence.push({ kind, name });
    this.recordTimeline("evidence", `${kind}:${name}`);
  }

  async advanceBy(duration: TestDuration): Promise<void> {
    const durationMs = durationToMilliseconds(duration);
    await this.controls.clock.advanceBy(durationMs);
    this.recordTimeline("time", `advance:${durationMs}`);
  }

  async execute<T>(
    point: string,
    boundary: ScenarioBoundary,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    assertNonEmpty(point, "boundary point");
    if (this.executionDepth === 0) {
      this.propagatingInjectedProblem = undefined;
    }
    this.executionDepth += 1;
    try {
      this.recordTimeline("boundary", point, { boundary });
      const planned = this.findPlannedFailure(point, boundary);
      if (!planned) {
        return await this.executeOperation(operation);
      }

      if (planned.failure.kind === "duplicate-delivery") {
        this.planned.shift();
        this.recordTimeline("failure", point, { boundary, failure: planned.failure.kind });
        let result: T | undefined;
        for (let delivery = 0; delivery < planned.failure.deliveries; delivery += 1) {
          result = await this.executeOperation(operation);
        }
        return result as T;
      }

      this.consumePlannedFailure(planned);
      if (planned.failure.kind === "lost-response") {
        await this.executeOperation(operation);
      }
      if (planned.failure.virtualTimeAdvance !== undefined) {
        await this.advanceBy(planned.failure.virtualTimeAdvance);
      }

      this.recordTimeline("failure", point, { boundary, failure: planned.failure.kind });
      this.recordProblem(planned.failure.problem);
      this.propagatingInjectedProblem = planned.failure.problem;
      throw planned.failure.problem;
    } finally {
      this.executionDepth -= 1;
    }
  }

  async run(run: (scenario: ScenarioRuntime) => void | Promise<void>): Promise<ScenarioReport> {
    try {
      await run(this);
    } catch (error) {
      if (error instanceof ScenarioContractProblem) {
        throw error;
      }
      if (!(error instanceof Problem)) {
        throw new ScenarioContractProblem(
          `Scenario '${this.controls.scenarioId}' threw a non-Problem failure.`,
          error instanceof Error ? error : undefined,
        );
      }
      if (
        error !== this.propagatingInjectedProblem ||
        !this.expectedProblems.some(({ code }) => code === error.code)
      ) {
        throw error;
      }
    }

    if (this.planned.length > 0) {
      const next = this.planned[0];
      throw new ScenarioContractProblem(
        `Scenario '${this.controls.scenarioId}' did not reach failure point '${next?.point ?? "unknown"}'.`,
      );
    }
    this.assertExpectations();
    return this.createReport();
  }

  private async executeOperation<T>(operation: () => T | Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Problem)) {
        throw new ScenarioContractProblem(
          `Scenario '${this.controls.scenarioId}' boundary threw a non-Problem failure.`,
          error instanceof Error ? error : undefined,
        );
      }
      if (error !== this.propagatingInjectedProblem) {
        this.recordProblem(error);
      }
      throw error;
    }
  }

  private consumePlannedFailure(planned: PlannedFailure): void {
    planned.remaining -= 1;
    if (planned.remaining === 0) {
      this.planned.shift();
    }
  }

  private findPlannedFailure(
    point: string,
    boundary: ScenarioBoundary,
  ): PlannedFailure | undefined {
    const matchingIndex = this.planned.findIndex(
      (candidate) => candidate.point === point && candidate.boundary === boundary,
    );
    if (matchingIndex < 0) return undefined;
    if (matchingIndex > 0) {
      const expected = this.planned[0];
      throw new ScenarioContractProblem(
        `Scenario '${this.controls.scenarioId}' reached '${point}' before ordered failure point '${expected?.point ?? "unknown"}'.`,
      );
    }
    return this.planned[0];
  }

  private recordProblem(problem: Problem): void {
    this.problems.push(normalizeProblemDetails(problem.toJSON()));
  }

  private recordTimeline(
    kind: ScenarioTimelineEntry["kind"],
    name: string,
    fields: Pick<ScenarioTimelineEntry, "boundary" | "failure"> = {},
  ): void {
    this.timeline.push({
      at: this.controls.clock.now.toISOString(),
      ...fields,
      kind,
      name,
      sequence: this.timeline.length + 1,
    });
  }

  private assertExpectations(): void {
    for (const expected of this.expectedProblems) {
      const actual = this.problems.filter(({ code }) => code === expected.code).length;
      if (actual !== expected.count) {
        throw new ScenarioContractProblem(
          `Scenario '${this.controls.scenarioId}' expected Problem '${expected.code}' ${expected.count} time(s), received ${actual}.`,
        );
      }
    }
    for (const expected of this.expectations) {
      const actual = this.evidence.filter(
        ({ kind, name }) => kind === expected.kind && name === expected.name,
      ).length;
      if (actual !== expected.count) {
        throw new ScenarioContractProblem(
          `Scenario '${this.controls.scenarioId}' expected ${expected.kind} evidence '${expected.name}' ${expected.count} time(s), received ${actual}.`,
        );
      }
    }
  }

  private createReport(): ScenarioReport {
    return {
      evidence: this.evidence.map((record) => ({ ...record })),
      problems: this.problems.map((problem) => ({ ...problem })),
      replay: {
        initialTime: this.initialTime,
        scenarioId: this.controls.scenarioId,
        seed: this.controls.ids.seed,
        timeline: this.replayTimeline.map(cloneReplayFailure),
        virtualTime: this.controls.clock.now.toISOString(),
      },
      schemaVersion: SCENARIO_REPORT_SCHEMA_VERSION,
      status: "passed",
      timeline: this.timeline.map((entry) => ({ ...entry })),
    };
  }
}

export function replayScenarioRuntime(replay: ScenarioReplayMetadata): ScenarioRuntime {
  assertReplayMetadata(replay);
  const scenario = createScenarioRuntime({
    initialTime: replay.initialTime,
    scenarioId: replay.scenarioId,
    seed: replay.seed,
  });
  for (const step of replay.timeline) {
    scenario.at(step.point, step.boundary, fromReplayFailure(step));
  }
  return scenario;
}

export function serializeScenarioReport(report: ScenarioReport): string {
  return `${JSON.stringify(normalizeJsonValue(report, "scenario report"), undefined, 2)}\n`;
}

function problemFailure(
  kind: ScenarioProblemFailure["kind"],
  problem: Problem,
  options: { readonly occurrences?: number; readonly virtualTimeAdvance?: TestDuration } = {},
): ScenarioProblemFailure {
  const occurrences = options.occurrences ?? 1;
  assertPositiveSafeInteger(occurrences, `${kind} occurrence count`);
  return {
    kind,
    occurrences,
    problem,
    ...(options.virtualTimeAdvance === undefined
      ? {}
      : { virtualTimeAdvance: options.virtualTimeAdvance }),
  };
}

function toReplayFailure(
  point: string,
  boundary: ScenarioBoundary,
  failure: ScenarioFailure,
): ScenarioReplayFailure {
  if (failure.kind === "duplicate-delivery") {
    return { boundary, deliveries: failure.deliveries, kind: failure.kind, point };
  }
  return {
    boundary,
    kind: failure.kind,
    occurrences: failure.occurrences,
    point,
    problem: normalizeReplayProblem(failure.problem),
    ...(failure.virtualTimeAdvance === undefined
      ? {}
      : { virtualTimeAdvanceMs: durationToMilliseconds(failure.virtualTimeAdvance) }),
  };
}

function fromReplayFailure(step: ScenarioReplayFailure): ScenarioFailure {
  if (step.kind === "duplicate-delivery") {
    return duplicateDelivery(step.deliveries);
  }
  assertPositiveSafeInteger(step.occurrences, `${step.kind} replay occurrence count`);
  return problemFailure(step.kind, problemFromDetails(step.problem), {
    occurrences: step.occurrences,
    ...(step.virtualTimeAdvanceMs === undefined
      ? {}
      : { virtualTimeAdvance: step.virtualTimeAdvanceMs }),
  });
}

function problemFromDetails(details: ScenarioReplayProblemDetails): Problem {
  return new ReplayedScenarioProblem(normalizeReplayProblemDetails(details));
}

function cloneReplayFailure(step: ScenarioReplayFailure): ScenarioReplayFailure {
  return step.kind === "duplicate-delivery"
    ? { ...step }
    : { ...step, problem: normalizeReplayProblemDetails(step.problem) };
}

function assertReplayMetadata(replay: ScenarioReplayMetadata): void {
  if (!isPlainRecord(replay)) {
    throw new ScenarioContractProblem("Scenario replay metadata must be an object.");
  }
  assertNonEmpty(replay.scenarioId, "replay scenario ID");
  assertNonEmpty(replay.seed, "replay seed");
  assertNonEmpty(replay.initialTime, "replay initial time");
  assertNonEmpty(replay.virtualTime, "replay virtual time");
  assertValidTimestamp(replay.initialTime, "replay initial time");
  assertValidTimestamp(replay.virtualTime, "replay virtual time");
  if (!Array.isArray(replay.timeline)) {
    throw new ScenarioContractProblem("Scenario replay timeline must be an array.");
  }
  for (const step of replay.timeline as readonly unknown[]) {
    if (!isPlainRecord(step)) {
      throw new ScenarioContractProblem("Scenario replay timeline steps must be objects.");
    }
    const point = step["point"];
    const boundary = step["boundary"];
    const kind = step["kind"];
    const deliveries = step["deliveries"];
    const occurrences = step["occurrences"];
    const problem = step["problem"];
    const virtualTimeAdvanceMs = step["virtualTimeAdvanceMs"];
    assertNonEmpty(point, "replay failure point");
    if (
      typeof boundary !== "string" ||
      !SCENARIO_BOUNDARIES.includes(boundary as ScenarioBoundary)
    ) {
      throw new ScenarioContractProblem(
        `Scenario replay boundary '${String(boundary)}' is unsupported.`,
      );
    }
    if (typeof kind !== "string" || !SCENARIO_FAILURE_KINDS.includes(kind as ScenarioFailureKind)) {
      throw new ScenarioContractProblem(
        `Scenario replay failure kind '${String(kind)}' is unsupported.`,
      );
    }
    if (kind === "duplicate-delivery") {
      assertPositiveSafeInteger(deliveries, "replay duplicate delivery count");
    } else {
      assertPositiveSafeInteger(occurrences, `${kind} replay occurrence count`);
      normalizeReplayProblemDetails(problem);
      if (
        virtualTimeAdvanceMs !== undefined &&
        (typeof virtualTimeAdvanceMs !== "number" ||
          !Number.isSafeInteger(virtualTimeAdvanceMs) ||
          virtualTimeAdvanceMs < 0)
      ) {
        throw new ScenarioContractProblem(
          `Scenario replay virtual-time advance for '${point}' must be a non-negative safe integer.`,
        );
      }
    }
  }
}

function normalizeReplayProblem(problem: Problem): ScenarioReplayProblemDetails {
  return {
    ...normalizeProblemDetails(problem.toJSON()),
    category: problem.category,
  };
}

function normalizeReplayProblemDetails(value: unknown): ScenarioReplayProblemDetails {
  const category = isPlainRecord(value) ? value["category"] : undefined;
  if (
    !isPlainRecord(value) ||
    typeof category !== "string" ||
    !Object.values(ProblemCategory).includes(category as ProblemCategory)
  ) {
    throw new ScenarioContractProblem("Scenario replay Problem category is invalid.");
  }
  const details = { ...value };
  delete details["category"];
  return {
    ...normalizeProblemDetails(details as ProblemDetails),
    category: category as ProblemCategory,
  };
}

function normalizeProblemDetails(details: ProblemDetails): ProblemDetails {
  if (
    typeof details !== "object" ||
    details === null ||
    typeof details.code !== "string" ||
    typeof details.status !== "number" ||
    typeof details.title !== "string" ||
    typeof details.type !== "string"
  ) {
    throw new ScenarioContractProblem("Scenario Problem details are incomplete.");
  }
  assertPlainJsonShape(details, "Scenario Problem details", new WeakSet());
  let redacted: unknown;
  try {
    redacted = redactTestEvidence(details);
  } catch (error) {
    throw new ScenarioContractProblem(
      "Scenario Problem details must be acyclic and redaction-safe.",
      error instanceof Error ? error : undefined,
    );
  }
  return normalizeJsonValue(redacted, "Scenario Problem details") as ProblemDetails;
}

function assertPlainJsonShape(value: unknown, field: string, ancestors: WeakSet<object>): void {
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object") {
    throw new ScenarioContractProblem(`${field} must contain only JSON-compatible values.`);
  }
  if (ancestors.has(value)) {
    throw new ScenarioContractProblem(`${field} must not contain cyclic values.`);
  }
  if (!Array.isArray(value) && !isPlainRecord(value)) {
    throw new ScenarioContractProblem(`${field} must contain only plain JSON objects.`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (const entry of value) assertPlainJsonShape(entry, field, ancestors);
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        throw new ScenarioContractProblem(`${field} contains forbidden key '${key}'.`);
      }
      assertPlainJsonShape(entry, field, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function normalizeJsonValue(value: unknown, field: string): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((entry) => normalizeJsonValue(entry, field));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ScenarioContractProblem(`${field} must contain only plain JSON objects.`);
    }
    const keys = Object.keys(record).sort();
    for (const key of keys) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        throw new ScenarioContractProblem(`${field} contains forbidden key '${key}'.`);
      }
    }
    return Object.fromEntries(keys.map((key) => [key, normalizeJsonValue(record[key], field)]));
  }
  throw new ScenarioContractProblem(`${field} must contain only JSON-compatible values.`);
}

function durationToMilliseconds(duration: TestDuration): number {
  if (typeof duration === "number") return duration;
  const match = /^(\d+)(ms|s|m)$/.exec(duration);
  if (!match) {
    throw new ScenarioContractProblem(`Scenario duration '${duration}' is invalid.`);
  }
  const amount = Number(match[1]);
  const multiplier = match[2] === "m" ? 60_000 : match[2] === "s" ? 1_000 : 1;
  return amount * multiplier;
}

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ScenarioContractProblem(`Scenario ${field} must not be empty.`);
  }
}

function assertValidTimestamp(value: string, field: string): void {
  if (!Number.isFinite(new Date(value).getTime())) {
    throw new ScenarioContractProblem(`Scenario ${field} must be a valid timestamp.`);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPositiveSafeInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ScenarioContractProblem(`Scenario ${field} must be a positive safe integer.`);
  }
}
