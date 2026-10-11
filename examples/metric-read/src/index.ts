import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { compileMetric, defineMetric, eq, evaluateMetric, project, sum } from "@croco/metrics-core";
import { MetricReadProblem, MetricReadService } from "@croco/metrics-core/runtime";
import { ProblemCategory } from "@croco/problems-core";

import type { MetricFact } from "@croco/metrics-core";
import type {
  MetricReadAuthority,
  MetricReadContext,
  MetricReadQuality,
  MetricReadResult,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  VerifiedMetricReport,
  VerifiedReportReader,
} from "@croco/metrics-core/runtime";

const fact = {
  name: "captures",
  kind: "transaction",
  columns: {
    capturedAt: { type: "instant" },
    amountMinor: { type: "money", currency: "currency" },
    currency: { type: "currency" },
  },
  sourceRefs: ["captures"],
} as const satisfies MetricFact;

const declaration = defineMetric("captured-amount", {
  version: 1,
  from: fact,
  measure: sum(project(fact, "amountMinor")),
  filter: eq(project(fact, "currency"), "USD"),
  time: project(fact, "capturedAt"),
  population: "paid-captures",
  unit: "minor-USD",
});

const window = {
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-09-02T00:00:00.000Z",
} as const;
const budget = {
  maxWindowMs: 86_400_000,
  maxRows: 100,
  maxBytes: 10_000,
  maxTimeMs: 1_000,
  maxConcurrency: 1,
  maxCost: 10,
} as const;
const completeQuality: MetricReadQuality = {
  temporalCompleteness: "complete",
  freshness: "fresh",
  populationCoverage: "complete",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};

function digest(result: MetricReadResult): string {
  return createHash("sha256").update(JSON.stringify(result)).digest("hex");
}

function readInput(input: unknown): string {
  if (input !== "USD") {
    throw new MetricReadProblem(
      "metric-read-example/invalid-input",
      ProblemCategory.ValidationError,
      "Only the registered USD input is supported",
    );
  }
  return input;
}

function readOutput(output: unknown): unknown {
  if (!Array.isArray(output) || output.length !== 1 || output[0]?.value !== "4200") {
    throw new MetricReadProblem(
      "metric-read-example/invalid-output",
      ProblemCategory.InternalServerError,
      "The result must contain the calculated capture total",
    );
  }
  return output;
}

async function main(): Promise<void> {
  const identity = await compileMetric(declaration);
  const definition: RegisteredMetricDefinition = {
    ...identity,
    description: "Captured USD amount in minor units",
    requiredFields: ["amountMinor", "currency"],
    requiresRaw: false,
  };
  let revision = "capture-snapshot-1";
  let executions = 0;
  const currentContext = (): MetricReadContext => ({
    principal: {
      app: "metric-read-example",
      environment: "demo",
      tenant: "demo-tenant",
      subject: "demo-operator",
    },
    allowedFields: ["amountMinor", "currency"],
    allowRaw: false,
    budget,
    sourceRevisions: [{ sourceRef: "captures", revision }],
    snapshotRefs: [revision],
  });
  const authority: MetricReadAuthority = {
    currentContext,
    async authorize(context, action) {
      if (
        context.principal.app !== "metric-read-example" ||
        context.principal.tenant !== "demo-tenant" ||
        action.definitionIds.length !== 1 ||
        action.definitionIds[0] !== definition.id
      ) {
        return null;
      }
      return { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" };
    },
  };
  const makeResult = (context: MetricReadContext, quality: MetricReadQuality): MetricReadResult => {
    const data = evaluateMetric(
      declaration,
      [
        {
          capturedAt: "2026-09-01T12:00:00.000Z",
          amountMinor: "4200",
          currency: "USD",
        },
      ],
      window,
    );
    return {
      data,
      principal: context.principal,
      definition: identity,
      unit: identity.unit,
      population: identity.population,
      filter: "currency=USD",
      fieldRefs: ["amountMinor", "currency"],
      window,
      sourceRevisions: context.sourceRevisions,
      snapshotRefs: context.snapshotRefs,
      quality,
      diagnostics: quality.populationCoverage === "partial" ? ["source-coverage-partial"] : [],
      rows: data.length,
      bytes: new TextEncoder().encode(JSON.stringify(data)).length,
      cost: 1,
    };
  };
  const query: RegisteredMetricQuery = {
    id: "captured-amount-usd",
    version: 1,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: "currency=USD",
    requiredFields: definition.requiredFields,
    requiresRaw: false,
    limits: budget,
    inputSchema: { parse: readInput },
    outputSchema: { parse: readOutput },
    inputKey: (input) => readInput(input),
    async readExecutor({ context }) {
      executions += 1;
      return makeResult(context, { ...completeQuality, populationCoverage: "partial" });
    },
  };

  const reportResult = makeResult(currentContext(), completeQuality);
  const resultHash = digest(reportResult);
  const report: VerifiedMetricReport = {
    id: "reviewed-capture-report",
    queryId: query.id,
    queryVersion: query.version,
    inputKey: "USD",
    resultHash,
    result: reportResult,
    reviewed: {
      reviewerId: "demo-reviewer",
      reviewedAt: "2026-09-02T12:00:00.000Z",
      definitionHash: definition.hash,
      resultHash,
    },
    permissionEpoch: "permission-1",
    privacyEpoch: "privacy-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
  const reports: VerifiedReportReader = {
    async readCandidates(queryId, inputKey) {
      return queryId === query.id && inputKey === report.inputKey ? [report] : [];
    },
    async verify(candidate) {
      return (
        candidate.resultHash === digest(candidate.result) &&
        candidate.reviewed.resultHash === candidate.resultHash &&
        candidate.reviewed.definitionHash === definition.hash &&
        candidate.reviewed.reviewerId === "demo-reviewer" &&
        candidate.reviewed.reviewedAt === "2026-09-02T12:00:00.000Z"
      );
    },
  };
  const service = new MetricReadService([definition], [query], authority, reports);

  const exact = await service.runRegisteredQuery(query.id, "USD", window);
  assert(exact.status === "verified");
  assert.equal(exact.source, "report");
  assert.equal(executions, 0);

  revision = "capture-snapshot-2";
  const changedSource = await service.runRegisteredQuery(query.id, "USD", window);
  assert(changedSource.status === "partial");
  assert.equal(executions, 1);

  console.log(
    JSON.stringify({
      definition: { id: identity.id, version: identity.version, hash: identity.hash },
      exact: { status: exact.status, source: exact.source, executions: 0 },
      changedSource: { status: changedSource.status, executions },
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
