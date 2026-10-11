import { createHash, randomUUID } from "node:crypto";
import { InMemoryBillableUsageJournal } from "@croco/metering-core";
import { MetricReadService } from "@croco/metrics-core/runtime";
import { GrowthAnalysisService } from "@croco/analytics-core/runtime";

import type { AnalysisModelRequest, ProposeAnalysisPlan } from "@croco/analytics-core";
import type { AnalysisRegistration } from "@croco/analytics-core/runtime";
import type {
  MetricReadResult,
  RegisteredMetricQuery,
  VerifiedMetricReport,
} from "@croco/metrics-core/runtime";

export const definition = {
  id: "activation-rate",
  version: 1,
  hash: "sha256:synthetic-activation-v1",
  unit: "ratio",
  population: "new-demo-accounts",
  sourceRefs: ["activation-snapshot"],
  description: "Accounts completing onboarding divided by new accounts",
  requiredFields: ["activationRate"],
  requiresRaw: false,
};
const window = { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" };
const budget = {
  maxWindowMs: 31 * 86_400_000,
  maxRows: 10,
  maxBytes: 4096,
  maxTimeMs: 1000,
  maxConcurrency: 1,
  maxCost: 1,
};
const principal = {
  app: "demo",
  environment: "local",
  tenant: "synthetic-tenant",
  subject: "synthetic-operator",
};
const revisions = [{ sourceRef: "activation-snapshot", revision: "snapshot-1" }];
const result: MetricReadResult = {
  data: { value: "0.42" },
  principal,
  definition,
  unit: definition.unit,
  population: definition.population,
  filter: "new-accounts",
  fieldRefs: ["activationRate"],
  window,
  sourceRevisions: revisions,
  snapshotRefs: ["snapshot-1"],
  numerator: "42",
  denominator: "100",
  quality: {
    temporalCompleteness: "complete",
    freshness: "fresh",
    populationCoverage: "complete",
    validity: "valid",
    exactness: "exact",
    reproducibility: "reproducible",
  },
  diagnostics: [],
  rows: 1,
  bytes: 16,
  cost: 1,
};
const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const hash = digest(result);
const report: VerifiedMetricReport = {
  id: "reviewed-activation",
  queryId: "activation",
  queryVersion: 1,
  inputKey: "new-accounts",
  resultHash: hash,
  result,
  reviewed: {
    reviewerId: "synthetic-reviewer",
    reviewedAt: "2026-10-01T00:00:00.000Z",
    definitionHash: definition.hash,
    resultHash: hash,
  },
  permissionEpoch: "permission-1",
  privacyEpoch: "privacy-1",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

export function selectedIds(
  request: Pick<AnalysisModelRequest, "question" | "choices">,
): readonly string[] {
  const question = request.question.toLowerCase();
  if (!question.includes("activation") && !question.includes("why")) return [];
  return question.includes("ambiguous")
    ? request.choices.map((choice) => choice.id)
    : request.choices.slice(0, 1).map((choice) => choice.id);
}

export const deterministicProposal: ProposeAnalysisPlan = async (request) => ({
  json: JSON.stringify({ choiceIds: selectedIds(request) }),
  completion: "complete",
  usage: { kind: "estimated", inputTokens: 100, outputTokens: 10 },
});

export function createFixture(model: ProposeAnalysisPlan, state = "ready") {
  let executions = 0;
  const journal = new InMemoryBillableUsageJournal();
  const query: RegisteredMetricQuery = {
    id: "activation",
    version: 1,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: result.filter,
    requiredFields: definition.requiredFields,
    requiresRaw: false,
    limits: budget,
    inputSchema: {
      parse(input) {
        if (input !== "new-accounts") throw new Error("Unsupported registered input");
        return input;
      },
    },
    outputSchema: {
      parse(output) {
        if (!output || typeof output !== "object" || !("value" in output))
          throw new Error("Invalid aggregate");
        return output;
      },
    },
    inputKey: () => "new-accounts",
    async readExecutor() {
      executions++;
      if (state === "error") throw new Error("Synthetic provider failure");
      return {
        ...result,
        data: state === "missing" ? { value: null } : result.data,
        quality: {
          ...result.quality,
          ...(state === "partial" ? { temporalCompleteness: "partial" as const } : {}),
          ...(state === "stale" ? { freshness: "stale" as const } : {}),
        },
      };
    },
  };
  const registration: AnalysisRegistration = {
    id: "september-activation",
    label: "September activation for new accounts",
    queryId: query.id,
    version: query.version,
    definitionId: definition.id,
    parameters: "new-accounts",
    window,
    assumptions: ["Only new demo accounts are included.", "The period is [from, to) in UTC."],
    facts(output) {
      const data = output.data as { value: string | null };
      return [{ label: "Activation rate", value: data.value }];
    },
  };
  const runner = new MetricReadService(
    [definition],
    [query],
    {
      currentContext: () => ({
        principal,
        allowedFields: ["activationRate"],
        allowRaw: false,
        budget,
        sourceRevisions: revisions,
        snapshotRefs: ["snapshot-1"],
      }),
      authorize: async (_context, action) =>
        state === "denied" && action.window
          ? null
          : { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" },
    },
    {
      readCandidates: async () => (state === "ready" ? [report] : []),
      verify: async (candidate) =>
        candidate.resultHash === digest(candidate.result) &&
        candidate.reviewed.resultHash === hash &&
        candidate.reviewed.definitionHash === definition.hash &&
        candidate.reviewed.reviewerId === "synthetic-reviewer",
    },
  );
  const contextRef = () =>
    digest({ principal, permissionEpoch: "permission-1", privacyEpoch: "privacy-1" });
  const service = new GrowthAnalysisService({
    contextRef,
    readService: runner,
    registrations: () =>
      state === "empty"
        ? []
        : [
            registration,
            {
              ...registration,
              id: "explicit-review",
              label: "Same period with explicit population review",
              assumptions: [
                ...registration.assumptions,
                "Confirm the new-account population before interpreting why.",
              ],
            },
          ],
    proposeAnalysisPlan: model,
    prepareQuestion: (question) =>
      /@|\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/.test(question) ? null : question,
    limits: {
      maxInputBytes: 8192,
      maxOutputBytes: 1024,
      maxOutputTokens: 128,
      maxTimeMs: 2000,
      maxConcurrency: 1,
    },
    invocationId: randomUUID,
    settleUsage: async (receipt) => {
      if (receipt.usage.kind !== "known") return; // Unknown/estimated is not billable measured usage.
      await journal.append({
        eventId: receipt.invocationId,
        tenantId: principal.tenant,
        meterId: "model-tokens",
        aggregation: "SUM",
        unit: "token",
        value: receipt.usage.inputTokens + receipt.usage.outputTokens,
        dimensions: { completion: receipt.completion },
      });
    },
  });
  return { service, runner, registration, journal, contextRef, executions: () => executions };
}
