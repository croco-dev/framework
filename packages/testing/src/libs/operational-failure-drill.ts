import { Problem, type ProblemDetails } from "@croco/problems-core";

export const OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION =
  "croco.operational-failure-drills/v1" as const;

class OperationalFailureDrillContractError extends Error {
  readonly code = "CROCO_TESTING_OPERATIONAL_FAILURE_DRILL_CONTRACT_INVALID";

  constructor(detail: string) {
    super(`CROCO_TESTING_OPERATIONAL_FAILURE_DRILL_CONTRACT_INVALID: ${detail}`);
    this.name = "OperationalFailureDrillContractError";
  }
}

export const OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS = [
  "provider-environment-missing",
  "telemetry-exporter-unavailable",
  "di-provider-missing",
  "di-scope-mismatch",
  "route-validation-failure",
  "rate-limit-exhausted",
  "auth-verifier-unavailable",
  "webhook-signature-invalid",
] as const;

export type OperationalFailureDrillScenarioId =
  (typeof OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS)[number];

export type OperationalFailureDrillOutcomeKind = "diagnostic" | "problem";

export const OPERATIONAL_FAILURE_DRILL_OUTCOME_KINDS = {
  "auth-verifier-unavailable": "problem",
  "di-provider-missing": "problem",
  "di-scope-mismatch": "problem",
  "provider-environment-missing": "diagnostic",
  "rate-limit-exhausted": "problem",
  "route-validation-failure": "problem",
  "telemetry-exporter-unavailable": "problem",
  "webhook-signature-invalid": "problem",
} as const satisfies Record<OperationalFailureDrillScenarioId, OperationalFailureDrillOutcomeKind>;

export type OperationalFailureDrillJsonValue =
  | boolean
  | number
  | string
  | null
  | readonly OperationalFailureDrillJsonValue[]
  | { readonly [key: string]: OperationalFailureDrillJsonValue };

export type OperationalFailureDrillProvenance = {
  readonly boundary: string;
  readonly fixture: string;
};

export type OperationalFailureDrillDiagnostic = {
  readonly code: string;
  readonly fields?: Readonly<Record<string, OperationalFailureDrillJsonValue>>;
};

export type OperationalFailureDrillProblemExpectation = {
  readonly code: string;
  readonly extensions?: Readonly<Record<string, OperationalFailureDrillJsonValue>>;
  readonly status?: number;
  readonly title?: string;
  readonly type?: string;
};

export type OperationalFailureDrillDiagnosticExpectation = {
  readonly code: string;
  readonly fields?: Readonly<Record<string, OperationalFailureDrillJsonValue>>;
};

type OperationalFailureDrillExpectedOutcomeBase = {
  readonly provenance: OperationalFailureDrillProvenance;
  readonly recoveryAction: string;
};

export type OperationalFailureDrillExpectedProblemOutcome =
  OperationalFailureDrillExpectedOutcomeBase & {
    readonly diagnostics?: readonly OperationalFailureDrillDiagnosticExpectation[];
    readonly kind: "problem";
    readonly problem: OperationalFailureDrillProblemExpectation;
  };

export type OperationalFailureDrillExpectedDiagnosticOutcome =
  OperationalFailureDrillExpectedOutcomeBase & {
    readonly diagnostic: OperationalFailureDrillDiagnosticExpectation;
    readonly kind: "diagnostic";
  };

export type OperationalFailureDrillExpectedOutcome =
  | OperationalFailureDrillExpectedDiagnosticOutcome
  | OperationalFailureDrillExpectedProblemOutcome;

type OperationalFailureDrillOutcomeBase = {
  readonly provenance: OperationalFailureDrillProvenance;
  readonly recoveryAction: string;
};

export type OperationalFailureDrillProblemOutcome = OperationalFailureDrillOutcomeBase & {
  readonly diagnostics?: readonly OperationalFailureDrillDiagnostic[];
  readonly kind: "problem";
  readonly problem: Problem | ProblemDetails;
};

export type OperationalFailureDrillDiagnosticOutcome = OperationalFailureDrillOutcomeBase & {
  readonly diagnostic: OperationalFailureDrillDiagnostic;
  readonly kind: "diagnostic";
};

export type OperationalFailureDrillOutcome =
  | OperationalFailureDrillDiagnosticOutcome
  | OperationalFailureDrillProblemOutcome;

export type OperationalFailureDrillScenario = {
  readonly description: string;
  readonly expected: OperationalFailureDrillExpectedOutcome;
  readonly id: OperationalFailureDrillScenarioId;
  readonly name: string;
  run(): OperationalFailureDrillOutcome | Promise<OperationalFailureDrillOutcome>;
};

export type OperationalFailureDrillProblemResult = Omit<
  OperationalFailureDrillProblemOutcome,
  "problem"
> & {
  readonly problem: ProblemDetails;
};

export type OperationalFailureDrillResult = {
  readonly id: OperationalFailureDrillScenarioId;
  readonly name: string;
  readonly outcome: OperationalFailureDrillDiagnosticOutcome | OperationalFailureDrillProblemResult;
};

export type OperationalFailureDrillReport = {
  readonly outcomeKinds: readonly OperationalFailureDrillOutcomeKind[];
  readonly results: readonly OperationalFailureDrillResult[];
  readonly scenarioIds: readonly OperationalFailureDrillScenarioId[];
  readonly schemaVersion: typeof OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION;
  readonly status: "passed";
};

export function createOperationalFailureDrillMatrix(
  scenarios: readonly OperationalFailureDrillScenario[],
): readonly OperationalFailureDrillScenario[] {
  assertOperationalFailureDrillMatrix(scenarios);
  return [...scenarios];
}

export function assertOperationalFailureDrillMatrix(
  scenarios: readonly OperationalFailureDrillScenario[],
): void {
  const scenarioIds = scenarios.map(({ id }) => id as string);
  const expectedIds = new Set<string>(OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS);
  const unexpectedId = scenarioIds.find((id) => !expectedIds.has(id));
  if (unexpectedId) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill matrix contains unexpected scenario '${unexpectedId}'.`,
    );
  }

  const duplicateId = scenarioIds.find((id, index) => scenarioIds.indexOf(id) !== index);
  if (duplicateId) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill matrix duplicates scenario '${duplicateId}'.`,
    );
  }

  const missingId = OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS.find((id) => !scenarioIds.includes(id));
  if (missingId) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill matrix is missing required scenario '${missingId}'.`,
    );
  }

  for (const [index, expectedId] of OPERATIONAL_FAILURE_DRILL_SCENARIO_IDS.entries()) {
    const scenario = scenarios[index];
    if (scenario?.id !== expectedId) {
      throw new OperationalFailureDrillContractError(
        `Operational failure drill matrix expected scenario '${expectedId}' at index ${index}, received '${scenario?.id ?? "none"}'.`,
      );
    }

    const expectedKind = OPERATIONAL_FAILURE_DRILL_OUTCOME_KINDS[expectedId];
    if (scenario.expected.kind !== expectedKind) {
      throw new OperationalFailureDrillContractError(
        `Operational failure drill '${expectedId}' must expect outcome kind '${expectedKind}', received '${scenario.expected.kind}'.`,
      );
    }

    assertExpectedRecoveryAndProvenance(scenario);
  }
}

export async function runOperationalFailureDrills(
  scenarios: readonly OperationalFailureDrillScenario[],
): Promise<OperationalFailureDrillReport> {
  assertOperationalFailureDrillMatrix(scenarios);
  const results: OperationalFailureDrillResult[] = [];

  for (const scenario of scenarios) {
    results.push(await runOperationalFailureDrillScenario(scenario));
  }

  return {
    outcomeKinds: results.map(({ outcome }) => outcome.kind),
    results,
    scenarioIds: results.map(({ id }) => id),
    schemaVersion: OPERATIONAL_FAILURE_DRILL_SCHEMA_VERSION,
    status: "passed",
  };
}

export async function runOperationalFailureDrillScenario(
  scenario: OperationalFailureDrillScenario,
): Promise<OperationalFailureDrillResult> {
  const outcome = await scenario.run();
  assertOperationalFailureDrillOutcome(scenario, outcome);

  return {
    id: scenario.id,
    name: scenario.name,
    outcome: normalizeOutcome(outcome),
  };
}

export function assertOperationalFailureDrillOutcome(
  scenario: OperationalFailureDrillScenario,
  outcome: OperationalFailureDrillOutcome,
): void {
  const { expected } = scenario;
  if (outcome.kind !== expected.kind) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenario.id}' expected outcome kind '${expected.kind}', received '${outcome.kind}'.`,
    );
  }

  assertRecoveryAction(scenario.id, outcome.recoveryAction, expected.recoveryAction);
  assertProvenance(scenario.id, outcome.provenance, expected.provenance);

  if (outcome.kind === "diagnostic" && expected.kind === "diagnostic") {
    assertDiagnostic(scenario.id, outcome.diagnostic, expected.diagnostic);
    return;
  }

  if (outcome.kind === "problem" && expected.kind === "problem") {
    const problem = toProblemDetails(outcome.problem);
    assertProblem(scenario.id, problem, expected.problem);
    assertDiagnostics(scenario.id, outcome.diagnostics ?? [], expected.diagnostics ?? []);
  }
}

export function serializeOperationalFailureDrillReport(
  report: OperationalFailureDrillReport,
): string {
  return `${JSON.stringify(sortJsonValue(report), null, 2)}\n`;
}

export function renderOperationalFailureDrillMarkdown(
  report: OperationalFailureDrillReport,
): string {
  const rows = report.results.map((result) => {
    const code =
      result.outcome.kind === "problem"
        ? result.outcome.problem.code
        : result.outcome.diagnostic.code;
    return `| ${escapeMarkdown(result.id)} | ${result.outcome.kind} | ${escapeMarkdown(code)} | ${escapeMarkdown(result.outcome.recoveryAction)} | ${escapeMarkdown(result.outcome.provenance.boundary)} | ${escapeMarkdown(result.outcome.provenance.fixture)} |`;
  });

  return [
    "# Operational failure drills",
    "",
    `Schema: \`${report.schemaVersion}\``,
    "",
    `Status: **${report.status}**`,
    "",
    "| Scenario | Outcome | Code | Recovery action | Boundary | Fixture |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function assertExpectedRecoveryAndProvenance(scenario: OperationalFailureDrillScenario): void {
  const expectedCode =
    scenario.expected.kind === "problem"
      ? scenario.expected.problem.code
      : scenario.expected.diagnostic.code;
  if (expectedCode.trim().length === 0) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenario.id}' must expect a non-empty stable code.`,
    );
  }
  if (scenario.expected.recoveryAction.trim().length === 0) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenario.id}' must expect a non-empty recovery action.`,
    );
  }
  assertNonEmptyProvenance(scenario.id, scenario.expected.provenance, "expected");
}

function assertRecoveryAction(
  scenarioId: OperationalFailureDrillScenarioId,
  actual: string,
  expected: string,
): void {
  if (actual.trim().length === 0) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' did not return a recovery action.`,
    );
  }
  if (actual !== expected) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' expected recovery action '${expected}', received '${actual}'.`,
    );
  }
}

function assertProvenance(
  scenarioId: OperationalFailureDrillScenarioId,
  actual: OperationalFailureDrillProvenance | undefined,
  expected: OperationalFailureDrillProvenance,
): void {
  if (!actual) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' did not return fixture provenance.`,
    );
  }
  assertNonEmptyProvenance(scenarioId, actual, "returned");
  if (actual.boundary !== expected.boundary) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' expected provenance boundary '${expected.boundary}', received '${actual.boundary}'.`,
    );
  }
  if (actual.fixture !== expected.fixture) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' expected provenance fixture '${expected.fixture}', received '${actual.fixture}'.`,
    );
  }
}

function assertNonEmptyProvenance(
  scenarioId: OperationalFailureDrillScenarioId,
  provenance: OperationalFailureDrillProvenance,
  source: string,
): void {
  if (provenance.boundary.trim().length === 0 || provenance.fixture.trim().length === 0) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' ${source} incomplete fixture provenance.`,
    );
  }
}

function assertProblem(
  scenarioId: OperationalFailureDrillScenarioId,
  problem: ProblemDetails,
  expected: OperationalFailureDrillProblemExpectation,
): void {
  assertEqualField(scenarioId, "Problem code", problem.code, expected.code);
  if (expected.status !== undefined) {
    assertEqualField(scenarioId, "Problem status", problem.status, expected.status);
  }
  if (expected.title !== undefined) {
    assertEqualField(scenarioId, "Problem title", problem.title, expected.title);
  }
  if (expected.type !== undefined) {
    assertEqualField(scenarioId, "Problem type", problem.type, expected.type);
  }
  for (const [key, value] of Object.entries(expected.extensions ?? {})) {
    if (!isJsonSubset(problem[key], value)) {
      throw new OperationalFailureDrillContractError(
        `Operational failure drill '${scenarioId}' expected Problem extension '${key}' to equal ${JSON.stringify(value)}.`,
      );
    }
  }
}

function assertDiagnostics(
  scenarioId: OperationalFailureDrillScenarioId,
  diagnostics: readonly OperationalFailureDrillDiagnostic[],
  expectedDiagnostics: readonly OperationalFailureDrillDiagnosticExpectation[],
): void {
  for (const expected of expectedDiagnostics) {
    const diagnostic = diagnostics.find(({ code }) => code === expected.code);
    if (!diagnostic) {
      throw new OperationalFailureDrillContractError(
        `Operational failure drill '${scenarioId}' expected diagnostic code '${expected.code}'.`,
      );
    }
    assertDiagnostic(scenarioId, diagnostic, expected);
  }
}

function assertDiagnostic(
  scenarioId: OperationalFailureDrillScenarioId,
  diagnostic: OperationalFailureDrillDiagnostic,
  expected: OperationalFailureDrillDiagnosticExpectation,
): void {
  assertEqualField(scenarioId, "diagnostic code", diagnostic.code, expected.code);
  for (const [key, value] of Object.entries(expected.fields ?? {})) {
    if (!isJsonSubset(diagnostic.fields?.[key], value)) {
      throw new OperationalFailureDrillContractError(
        `Operational failure drill '${scenarioId}' expected diagnostic field '${key}' to equal ${JSON.stringify(value)}.`,
      );
    }
  }
}

function assertEqualField(
  scenarioId: OperationalFailureDrillScenarioId,
  field: string,
  actual: string | number,
  expected: string | number,
): void {
  if (actual !== expected) {
    throw new OperationalFailureDrillContractError(
      `Operational failure drill '${scenarioId}' expected ${field} '${expected}', received '${actual}'.`,
    );
  }
}

function isJsonSubset(actual: unknown, expected: OperationalFailureDrillJsonValue): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => isJsonSubset(actual[index], value))
    );
  }
  if (isJsonRecord(expected)) {
    return (
      isUnknownRecord(actual) &&
      Object.entries(expected).every(([key, value]) => isJsonSubset(actual[key], value))
    );
  }
  return actual === expected;
}

function normalizeOutcome(
  outcome: OperationalFailureDrillOutcome,
): OperationalFailureDrillDiagnosticOutcome | OperationalFailureDrillProblemResult {
  if (outcome.kind === "diagnostic") {
    return {
      diagnostic: normalizeDiagnostic(outcome.diagnostic),
      kind: "diagnostic",
      provenance: { ...outcome.provenance },
      recoveryAction: outcome.recoveryAction,
    };
  }

  return {
    ...(outcome.diagnostics ? { diagnostics: outcome.diagnostics.map(normalizeDiagnostic) } : {}),
    kind: "problem",
    problem: normalizeProblemDetails(toProblemDetails(outcome.problem)),
    provenance: { ...outcome.provenance },
    recoveryAction: outcome.recoveryAction,
  };
}

function normalizeDiagnostic(
  diagnostic: OperationalFailureDrillDiagnostic,
): OperationalFailureDrillDiagnostic {
  return {
    code: diagnostic.code,
    ...(diagnostic.fields ? { fields: sortJsonRecord(diagnostic.fields) } : {}),
  };
}

function normalizeProblemDetails(problem: ProblemDetails): ProblemDetails {
  const normalized = sortJsonValue(problem);
  if (!isUnknownRecord(normalized)) {
    throw new OperationalFailureDrillContractError(
      "Operational failure drill Problem evidence must be a JSON object.",
    );
  }
  return normalized as ProblemDetails;
}

function toProblemDetails(problem: Problem | ProblemDetails): ProblemDetails {
  return problem instanceof Problem ? problem.toJSON() : problem;
}

function sortJsonRecord(
  record: Readonly<Record<string, OperationalFailureDrillJsonValue>>,
): Readonly<Record<string, OperationalFailureDrillJsonValue>> {
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortJsonValue(record[key])]),
  ) as Readonly<Record<string, OperationalFailureDrillJsonValue>>;
}

function sortJsonValue(value: unknown): OperationalFailureDrillJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (isUnknownRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, sortJsonValue(value[key])]),
    );
  }
  throw new OperationalFailureDrillContractError(
    "Operational failure drill reports only support JSON-compatible evidence.",
  );
}

function isJsonRecord(
  value: OperationalFailureDrillJsonValue,
): value is { readonly [key: string]: OperationalFailureDrillJsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
