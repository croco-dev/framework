import {
  Problem,
  ProblemCategory,
  ProblemCategoryMapper,
  type ProblemDetails,
} from "@croco/problems-core";

export const FAILURE_DRILL_SCENARIO_IDS = [
  "provider-timeout",
  "webhook-duplicate",
  "outbox-relay-crash",
  "telemetry-exporter-failure",
  "tenant-context-missing",
  "quota-exceeded",
] as const;

export type FailureDrillScenarioId = (typeof FAILURE_DRILL_SCENARIO_IDS)[number];

export type FailureDrillAttributeValue = boolean | number | string | null;

export type FailureDrillEvidenceKind =
  | "audit"
  | "diagnostic"
  | "idempotency"
  | "recovery"
  | "telemetry";

export type FailureDrillEvidenceRecord = {
  readonly attributes?: Record<string, FailureDrillAttributeValue>;
  readonly kind: FailureDrillEvidenceKind;
  readonly message?: string;
  readonly name: string;
};

export type FailureDrillProblemExpectation = {
  readonly code: string;
  readonly detailIncludes?: string | readonly string[];
  readonly status?: number;
  readonly title?: string;
};

export type FailureDrillEvidenceExpectation = {
  readonly audit: string | readonly string[];
  readonly diagnostic?: string | readonly string[];
  readonly telemetry: string | readonly string[];
};

export type FailureDrillExpectedOutcome = {
  readonly evidence: FailureDrillEvidenceExpectation;
  readonly problem: FailureDrillProblemExpectation;
  readonly recoveryAction: string;
};

export type FailureDrillRunOutput = {
  readonly evidence?: readonly FailureDrillEvidenceRecord[];
  readonly metadata?: Record<string, unknown>;
  readonly problem?: Problem | ProblemDetails;
  readonly recoveryAction?: string;
};

export type FailureDrillScenario = {
  readonly description: string;
  readonly expected: FailureDrillExpectedOutcome;
  readonly id: FailureDrillScenarioId | (string & {});
  readonly name: string;
  run(): FailureDrillRunOutput | Promise<FailureDrillRunOutput>;
};

export type FailureDrillResult = {
  readonly evidence: readonly FailureDrillEvidenceRecord[];
  readonly metadata?: Record<string, unknown>;
  readonly problem: ProblemDetails;
  readonly recoveryAction: string;
  readonly scenarioId: string;
  readonly scenarioName: string;
};

export type FailureDrillReport = {
  readonly results: readonly FailureDrillResult[];
  readonly status: "passed";
};

export type FailureDrillScenarioOverride = Partial<
  Omit<FailureDrillScenario, "expected" | "id">
> & {
  readonly expected?: Partial<Omit<FailureDrillExpectedOutcome, "evidence" | "problem">> & {
    readonly evidence?: Partial<FailureDrillEvidenceExpectation>;
    readonly problem?: Partial<FailureDrillProblemExpectation> & {
      readonly code: string;
    };
  };
};

export type FailureDrillCatalogOverrides = Partial<
  Record<FailureDrillScenarioId, FailureDrillScenarioOverride>
>;

type DefaultFailureDrillScenarioDefinition = {
  readonly audit: string;
  readonly category: ProblemCategory;
  readonly detail: string;
  readonly description: string;
  readonly diagnostic?: string;
  readonly id: FailureDrillScenarioId;
  readonly metadata?: Record<string, unknown>;
  readonly name: string;
  readonly problemCode: string;
  readonly recoveryAction: string;
  readonly telemetry: string;
};

const DEFAULT_FAILURE_DRILL_SCENARIOS = [
  {
    audit: "failure_drill.provider_timeout.audit",
    category: ProblemCategory.InternalServerError,
    detail: "Injected provider timeout exceeded the operation budget.",
    description: "Injects a provider timeout and verifies the timeout is surfaced as a Problem.",
    diagnostic: "failure_drill.provider_timeout.diagnostic",
    id: "provider-timeout",
    metadata: { timeoutMs: 50 },
    name: "Provider timeout",
    problemCode: "testing/provider-timeout",
    recoveryAction: "Retry with backoff or fail over to a healthy provider.",
    telemetry: "failure_drill.provider_timeout.failed",
  },
  {
    audit: "failure_drill.webhook_duplicate.audit",
    category: ProblemCategory.Conflict,
    detail: "Injected duplicate webhook delivery reused the idempotency key.",
    description: "Replays the same webhook delivery and verifies duplicate handling evidence.",
    diagnostic: "failure_drill.webhook_duplicate.diagnostic",
    id: "webhook-duplicate",
    metadata: { idempotencyKey: "failure-drill-webhook-duplicate" },
    name: "Webhook duplicate delivery",
    problemCode: "testing/webhook-duplicate-delivery",
    recoveryAction: "Return the stored idempotent outcome and suppress duplicate side effects.",
    telemetry: "failure_drill.webhook_duplicate.detected",
  },
  {
    audit: "failure_drill.outbox_relay_crash.audit",
    category: ProblemCategory.InternalServerError,
    detail: "Injected outbox relay crash stopped after persisting the outbox record.",
    description: "Crashes the relay boundary and verifies replay evidence is preserved.",
    diagnostic: "failure_drill.outbox_relay_crash.diagnostic",
    id: "outbox-relay-crash",
    metadata: { replayable: true },
    name: "Outbox relay crash",
    problemCode: "testing/outbox-relay-crash",
    recoveryAction: "Replay the persisted outbox record after the relay recovers.",
    telemetry: "failure_drill.outbox_relay_crash.failed",
  },
  {
    audit: "failure_drill.telemetry_exporter_failure.audit",
    category: ProblemCategory.InternalServerError,
    detail: "Injected telemetry exporter failure was recorded instead of treated as success.",
    description: "Fails telemetry export and verifies diagnostic evidence is present.",
    diagnostic: "failure_drill.telemetry_exporter_failure.diagnostic",
    id: "telemetry-exporter-failure",
    metadata: { exporter: "testing" },
    name: "Telemetry exporter failure",
    problemCode: "testing/telemetry-exporter-failure",
    recoveryAction: "Keep business failure evidence and inspect or replace the telemetry exporter.",
    telemetry: "failure_drill.telemetry_exporter_failure.detected",
  },
  {
    audit: "failure_drill.tenant_context_missing.audit",
    category: ProblemCategory.ValidationError,
    detail: "Injected tenant-aware operation ran without an active tenant context.",
    description: "Removes tenant context and verifies tenant isolation fails closed.",
    diagnostic: "failure_drill.tenant_context_missing.diagnostic",
    id: "tenant-context-missing",
    metadata: { tenantRequired: true },
    name: "Tenant context missing",
    problemCode: "testing/tenant-context-missing",
    recoveryAction: "Restore tenant context before retrying the tenant-scoped operation.",
    telemetry: "failure_drill.tenant_context_missing.failed_closed",
  },
  {
    audit: "failure_drill.quota_exceeded.audit",
    category: ProblemCategory.TooManyRequests,
    detail: "Injected quota exhaustion exceeded the configured usage limit.",
    description: "Exhausts a quota and verifies the request fails with explicit recovery evidence.",
    diagnostic: "failure_drill.quota_exceeded.diagnostic",
    id: "quota-exceeded",
    metadata: { quota: 1, attemptedUsage: 2 },
    name: "Quota exceeded",
    problemCode: "testing/quota-exceeded",
    recoveryAction: "Reject the operation and direct the tenant to reduce usage or upgrade.",
    telemetry: "failure_drill.quota_exceeded.rejected",
  },
] as const satisfies readonly DefaultFailureDrillScenarioDefinition[];

export function createFailureDrillCatalog(
  overrides: FailureDrillCatalogOverrides = {},
): readonly FailureDrillScenario[] {
  return DEFAULT_FAILURE_DRILL_SCENARIOS.map((definition) =>
    applyScenarioOverride(createDefaultFailureDrillScenario(definition), overrides[definition.id]),
  );
}

export async function runFailureDrills(
  scenarios: readonly FailureDrillScenario[] = createFailureDrillCatalog(),
): Promise<FailureDrillReport> {
  const results: FailureDrillResult[] = [];

  for (const scenario of scenarios) {
    results.push(await runFailureDrillScenario(scenario));
  }

  return {
    results,
    status: "passed",
  };
}

export async function runFailureDrillScenario(
  scenario: FailureDrillScenario,
): Promise<FailureDrillResult> {
  const result = normalizeFailureDrillResult(scenario, await scenario.run());
  assertFailureDrillResult(result, scenario.expected);
  return result;
}

export function assertFailureDrillResult(
  result: FailureDrillResult,
  expected: FailureDrillExpectedOutcome,
): void {
  assertProblemMatches(result, expected.problem);
  assertRecoveryActionMatches(result, expected.recoveryAction);
  assertExpectedEvidence(result, expected.evidence);
}

function createDefaultFailureDrillScenario(
  definition: DefaultFailureDrillScenarioDefinition,
): FailureDrillScenario {
  const problem = createProblemDetails(definition);
  const expected = {
    evidence: {
      ...(definition.diagnostic ? { diagnostic: definition.diagnostic } : {}),
      audit: definition.audit,
      telemetry: definition.telemetry,
    },
    problem: {
      code: definition.problemCode,
      status: problem.status,
      title: problem.title,
    },
    recoveryAction: definition.recoveryAction,
  } satisfies FailureDrillExpectedOutcome;

  return {
    description: definition.description,
    expected,
    id: definition.id,
    name: definition.name,
    run: () => ({
      evidence: createDefaultEvidence(definition),
      metadata: definition.metadata,
      problem,
      recoveryAction: definition.recoveryAction,
    }),
  };
}

function applyScenarioOverride(
  scenario: FailureDrillScenario,
  override: FailureDrillScenarioOverride | undefined,
): FailureDrillScenario {
  if (!override) {
    return scenario;
  }

  return {
    ...scenario,
    ...override,
    expected: {
      ...scenario.expected,
      ...override.expected,
      evidence: mergeExpectedEvidence(scenario.expected.evidence, override.expected?.evidence),
      problem: {
        ...scenario.expected.problem,
        ...override.expected?.problem,
      },
    },
    id: scenario.id,
  };
}

function mergeExpectedEvidence(
  base: FailureDrillEvidenceExpectation,
  override: Partial<FailureDrillEvidenceExpectation> | undefined,
): FailureDrillEvidenceExpectation {
  if (!override) {
    return base;
  }

  return {
    ...(override.diagnostic === undefined ? {} : { diagnostic: override.diagnostic }),
    audit: override.audit ?? base.audit,
    telemetry: override.telemetry ?? base.telemetry,
  };
}

function createProblemDetails(definition: DefaultFailureDrillScenarioDefinition): ProblemDetails {
  return {
    code: definition.problemCode,
    detail: definition.detail,
    recoveryAction: definition.recoveryAction,
    scenarioId: definition.id,
    status: ProblemCategoryMapper.toHttpStatus(definition.category),
    title: ProblemCategoryMapper.toTitle(definition.category),
    type: `https://docs.croco.dev/problems/testing/failure-drill/${definition.id}`,
  };
}

function createDefaultEvidence(
  definition: DefaultFailureDrillScenarioDefinition,
): readonly FailureDrillEvidenceRecord[] {
  return [
    {
      attributes: {
        "croco.failure_drill.scenario": definition.id,
        "croco.failure_drill.status": "failed",
      },
      kind: "telemetry",
      name: definition.telemetry,
    },
    {
      attributes: {
        "croco.failure_drill.problem_code": definition.problemCode,
        "croco.failure_drill.scenario": definition.id,
      },
      kind: "audit",
      name: definition.audit,
    },
    ...(definition.diagnostic
      ? [
          {
            attributes: {
              "croco.failure_drill.recovery_action": definition.recoveryAction,
              "croco.failure_drill.scenario": definition.id,
            },
            kind: "diagnostic" as const,
            name: definition.diagnostic,
          },
        ]
      : []),
  ];
}

function normalizeFailureDrillResult(
  scenario: FailureDrillScenario,
  output: FailureDrillRunOutput,
): FailureDrillResult {
  if (!output.problem) {
    throw new Error(`Failure drill '${scenario.id}' did not return a Problem.`);
  }
  if (!output.recoveryAction) {
    throw new Error(`Failure drill '${scenario.id}' did not return a recovery action.`);
  }

  return {
    evidence: output.evidence ?? [],
    metadata: output.metadata,
    problem: toProblemDetails(output.problem),
    recoveryAction: output.recoveryAction,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
  };
}

function toProblemDetails(problem: Problem | ProblemDetails): ProblemDetails {
  return problem instanceof Problem ? problem.toJSON() : problem;
}

function assertProblemMatches(
  result: FailureDrillResult,
  expected: FailureDrillProblemExpectation,
): void {
  const { problem } = result;

  if (problem.code !== expected.code) {
    throw new Error(
      `Failure drill '${result.scenarioId}' expected Problem code '${expected.code}', received '${problem.code}'.`,
    );
  }

  if (expected.status !== undefined && problem.status !== expected.status) {
    throw new Error(
      `Failure drill '${result.scenarioId}' expected Problem status ${expected.status}, received ${problem.status}.`,
    );
  }

  if (expected.title !== undefined && problem.title !== expected.title) {
    throw new Error(
      `Failure drill '${result.scenarioId}' expected Problem title '${expected.title}', received '${problem.title}'.`,
    );
  }

  for (const expectedDetail of toReadonlyArray(expected.detailIncludes)) {
    if (!problem.detail?.includes(expectedDetail)) {
      throw new Error(
        `Failure drill '${result.scenarioId}' expected Problem detail to include '${expectedDetail}'.`,
      );
    }
  }
}

function assertRecoveryActionMatches(
  result: FailureDrillResult,
  expectedRecoveryAction: string,
): void {
  if (result.recoveryAction !== expectedRecoveryAction) {
    throw new Error(
      `Failure drill '${result.scenarioId}' expected recovery action '${expectedRecoveryAction}', received '${result.recoveryAction}'.`,
    );
  }
}

function assertExpectedEvidence(
  result: FailureDrillResult,
  expected: FailureDrillEvidenceExpectation,
): void {
  assertEvidenceNames(result, "telemetry", expected.telemetry);
  assertEvidenceNames(result, "audit", expected.audit);

  if (expected.diagnostic !== undefined) {
    assertEvidenceNames(result, "diagnostic", expected.diagnostic);
  }
}

function assertEvidenceNames(
  result: FailureDrillResult,
  kind: FailureDrillEvidenceKind,
  expectedNames: string | readonly string[],
): void {
  const names = toReadonlyArray(expectedNames);
  if (names.length === 0) {
    throw new Error(
      `Failure drill '${result.scenarioId}' expected at least one ${kind} evidence name.`,
    );
  }

  const actualNames = result.evidence
    .filter((record) => record.kind === kind)
    .map((record) => record.name);

  for (const expectedName of names) {
    if (!actualNames.includes(expectedName)) {
      throw new Error(
        `Failure drill '${result.scenarioId}' expected ${kind} evidence '${expectedName}'.`,
      );
    }
  }
}

function toReadonlyArray(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) {
    return [];
  }
  return typeof value === "string" ? [value] : value;
}
