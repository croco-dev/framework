import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricReadService } from "../../../metrics-core/src/libs/read/MetricReadService";
import {
  AnalysisSettlementProblem,
  GrowthAnalysisProblem,
  GrowthAnalysisService,
} from "../libs/analysis/GrowthAnalysisService";
import type {
  MetricReadContext,
  MetricReadResult,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  VerifiedMetricReport,
} from "../../../metrics-core/src/libs/read/MetricReadService";
import type {
  AnalysisModelResponse,
  AnalysisPlan,
  AnalysisProposal,
  AnalysisUsage,
  ProposeAnalysisPlan,
} from "../libs/GrowthAnalysis";
import type {
  AnalysisRegistration,
  GrowthAnalysisServiceOptions,
} from "../libs/analysis/GrowthAnalysisService";

const window = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" };
const identity = {
  id: "captures_total",
  version: 1,
  hash: "sha256:defined",
  unit: "minor-USD",
  population: "paid-captures",
  sourceRefs: ["captures"],
};
const definition: RegisteredMetricDefinition = {
  ...identity,
  description: "Captured payments",
  requiredFields: ["amountMinor"],
  requiresRaw: false,
};
const context: MetricReadContext = {
  principal: { app: "example", environment: "test", tenant: "tenant-1", subject: "user-1" },
  allowedFields: ["amountMinor"],
  allowRaw: false,
  budget: {
    maxWindowMs: 86_400_000,
    maxRows: 10,
    maxBytes: 1_000,
    maxTimeMs: 1_000,
    maxConcurrency: 1,
    maxCost: 10,
  },
  sourceRevisions: [{ sourceRef: "captures", revision: "snapshot-1" }],
  snapshotRefs: ["snapshot-1"],
};
const result: MetricReadResult = {
  data: { amount: "9007199254740993" },
  principal: context.principal,
  definition: identity,
  unit: identity.unit,
  population: identity.population,
  filter: "currency=USD",
  fieldRefs: ["amountMinor"],
  window,
  sourceRevisions: context.sourceRevisions,
  snapshotRefs: context.snapshotRefs,
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
  bytes: 50,
  cost: 1,
  numerator: "9007199254740993",
  denominator: "10000000000000000",
};
const registration: AnalysisRegistration = {
  id: "captures",
  label: "Captured payment total",
  queryId: "captures_by_currency",
  version: 1,
  definitionId: definition.id,
  parameters: { currency: "USD" },
  window,
  assumptions: ["USD captures only"],
  facts: (read) => [
    { label: "Captured amount", value: (read.data as { amount: string | null }).amount },
  ],
};
const knownUsage: AnalysisUsage = { kind: "known", inputTokens: 20, outputTokens: 3 };
const response: AnalysisModelResponse = {
  json: JSON.stringify({ choiceIds: ["captures"] }),
  usage: knownUsage,
  completion: "complete",
};
function report(overrides: Partial<VerifiedMetricReport> = {}): VerifiedMetricReport {
  return {
    id: "reviewed-report",
    queryId: registration.queryId,
    queryVersion: 1,
    inputKey: "USD",
    resultHash: "sha256:result",
    result,
    reviewed: {
      reviewerId: "reviewer-1",
      reviewedAt: window.to,
      definitionHash: identity.hash,
      resultHash: "sha256:result",
    },
    permissionEpoch: "permission-1",
    privacyEpoch: "privacy-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}
function fixture(
  options: {
    report?: VerifiedMetricReport;
    result?: MetricReadResult;
    queryVersion?: number;
    executor?: RegisteredMetricQuery["readExecutor"];
    model?: ProposeAnalysisPlan;
    prepareQuestion?: GrowthAnalysisServiceOptions["prepareQuestion"];
    settleUsage?: GrowthAnalysisServiceOptions["settleUsage"];
    registrations?: readonly AnalysisRegistration[];
  } = {},
) {
  const state = { definition, context, contextRef: "tenant-1:permission-1:privacy-1" };
  const executor = vi.fn(options.executor ?? (async () => options.result ?? result));
  const query: RegisteredMetricQuery = {
    id: registration.queryId,
    version: options.queryVersion ?? 1,
    definitionRefs: [identity.id],
    unit: identity.unit,
    population: identity.population,
    filter: "currency=USD",
    requiredFields: ["amountMinor"],
    requiresRaw: false,
    limits: context.budget,
    inputSchema: { parse: (input) => input },
    outputSchema: { parse: (output) => output },
    inputKey: () => "USD",
    readExecutor: executor,
  };
  const reader = {
    readCandidates: vi.fn(async () => (options.report ? [options.report] : [])),
    verify: vi.fn(async () => true),
  };
  const model = vi.fn(options.model ?? (async () => response));
  const settleUsage = vi.fn(options.settleUsage ?? (async () => undefined));
  const createReadService = () =>
    new MetricReadService(
      [state.definition],
      [query],
      {
        currentContext: () => state.context,
        authorize: async () => ({ permissionEpoch: "permission-1", privacyEpoch: "privacy-1" }),
      },
      reader,
    );
  let currentDefinition = state.definition;
  let readService = createReadService();
  const service = new GrowthAnalysisService({
    get readService() {
      if (currentDefinition !== state.definition) {
        currentDefinition = state.definition;
        readService = createReadService();
      }
      return readService;
    },
    contextRef: () => state.contextRef,
    registrations: () => options.registrations ?? [registration],
    proposeAnalysisPlan: model,
    prepareQuestion: options.prepareQuestion ?? ((question) => question),
    limits: {
      maxInputBytes: 10_000,
      maxOutputBytes: 1_000,
      maxOutputTokens: 100,
      maxTimeMs: 100,
      maxConcurrency: 1,
    },
    invocationId: () => "invocation-1",
    settleUsage,
  });
  return { service, model, executor, reader, settleUsage, state };
}
function confirmedPlan(proposal: AnalysisProposal): AnalysisPlan {
  if (proposal.status !== "confirmation" || !proposal.choices[0])
    throw new Error("Expected confirmation choices");
  return proposal.choices[0].plan;
}
async function settlementFailure(
  pending: Promise<AnalysisProposal>,
): Promise<AnalysisSettlementProblem> {
  try {
    await pending;
  } catch (error) {
    if (error instanceof AnalysisSettlementProblem) return error;
    throw error;
  }
  throw new Error("Expected a settlement failure");
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

afterEach(() => vi.useRealTimers());

describe("GrowthAnalysisService", () => {
  it("returns exact reviewed report facts without executing a query", async () => {
    const { service, executor, reader } = fixture({ report: report() });
    const plan = confirmedPlan(await service.propose("How much was captured?"));
    expect(await service.execute(plan)).toEqual({
      status: "ready",
      answer: {
        facts: [{ label: "Captured amount", value: "9007199254740993" }],
        sourceRefs: identity.sourceRefs,
        snapshotRefs: result.snapshotRefs,
        window,
        population: identity.population,
        metricDefinition: identity,
        source: "report",
        availability: "ready",
        limitations: ["Observed facts do not establish a causal explanation."],
        numerator: result.numerator,
        denominator: result.denominator,
      },
    });
    expect(reader.verify).toHaveBeenCalledOnce();
    expect(executor).not.toHaveBeenCalled();
  });

  it("projects the same answer fields from the registered executor", async () => {
    const { service, executor } = fixture();
    const plan = confirmedPlan(await service.propose("How much was captured?"));
    expect(await service.execute(plan)).toEqual({
      status: "ready",
      answer: {
        facts: [{ label: "Captured amount", value: "9007199254740993" }],
        sourceRefs: identity.sourceRefs,
        snapshotRefs: result.snapshotRefs,
        window,
        population: identity.population,
        metricDefinition: identity,
        source: "executor",
        availability: "ready",
        limitations: ["Observed facts do not establish a causal explanation."],
        numerator: result.numerator,
        denominator: result.denominator,
      },
    });
    expect(executor).toHaveBeenCalledOnce();
  });

  it("returns ambiguous choices for confirmation before reading reports or executing", async () => {
    const { service, executor, reader } = fixture({
      registrations: [
        registration,
        { ...registration, id: "alternative", label: "Alternative interpretation" },
      ],
      model: async () => ({
        ...response,
        json: JSON.stringify({ choiceIds: ["captures", "alternative"] }),
      }),
    });
    const proposal = await service.propose("Explain growth");
    expect(proposal).toMatchObject({
      status: "confirmation",
      choices: [
        { id: "captures", plan: { coverage: "confirmation-required" } },
        { id: "alternative", plan: { coverage: "confirmation-required" } },
      ],
    });
    expect(executor).not.toHaveBeenCalled();
    expect(reader.readCandidates).not.toHaveBeenCalled();
  });

  it.each([{ tenant: "other" }, { tool: "unregistered" }, { sql: "unregistered query" }])(
    "rejects unregistered model fields %j before execution",
    async (extra) => {
      const { service, executor } = fixture({
        model: async () => ({
          ...response,
          json: JSON.stringify({ choiceIds: ["captures"], ...extra }),
        }),
      });
      await expect(service.propose("Captured total")).rejects.toMatchObject({
        code: "analytics-core/analysis-invalid-plan",
      });
      expect(executor).not.toHaveBeenCalled();
    },
  );

  it.each([{ tenant: "other" }, { tool: "unregistered" }, { sql: "unregistered query" }])(
    "rejects additional confirmed-plan fields %j without executing",
    async (extra) => {
      const { service, executor } = fixture();
      const plan = confirmedPlan(await service.propose("Captured total"));
      expect(await service.execute({ ...plan, ...extra })).toEqual({
        status: "definition-changed",
      });
      expect(executor).not.toHaveBeenCalled();
    },
  );

  it("rejects a confirmed plan after its definition changes", async () => {
    const { service, executor, state } = fixture();
    const plan = confirmedPlan(await service.propose("Captured total"));
    state.definition = { ...definition, hash: "sha256:updated" };
    expect(await service.execute(plan)).toEqual({ status: "definition-changed" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("rejects a confirmed plan after field permission is revoked", async () => {
    const { service, executor, state } = fixture();
    const plan = confirmedPlan(await service.propose("Captured total"));
    state.context = { ...context, allowedFields: [] };
    expect(await service.execute(plan)).toEqual({ status: "definition-changed" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("rejects a confirmed plan after the trusted authorization context changes", async () => {
    const { service, executor, state } = fixture();
    const plan = confirmedPlan(await service.propose("Captured total"));
    state.contextRef = "tenant-2:permission-1:privacy-1";
    expect(await service.execute(plan)).toEqual({ status: "definition-changed" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("discards a proposal if its authorization context changes during inference", async () => {
    const pending = deferred<AnalysisModelResponse>();
    const { service, model, state } = fixture({ model: () => pending.promise });
    const proposal = service.propose("Captured total");
    await vi.waitFor(() => expect(model).toHaveBeenCalledOnce());
    state.contextRef = "tenant-1:permission-2:privacy-1";
    pending.resolve(response);
    expect(await proposal).toEqual({
      status: "unavailable",
      reason: "definitions-changed",
      usage: knownUsage,
    });
  });

  it("settles usage before reporting malformed model JSON", async () => {
    const { service, settleUsage } = fixture({ model: async () => ({ ...response, json: "{" }) });
    await expect(service.propose("Captured total")).rejects.toMatchObject({
      code: "analytics-core/analysis-invalid-json",
    });
    expect(settleUsage).toHaveBeenCalledWith({
      invocationId: "invocation-1",
      usage: knownUsage,
      completion: "complete",
    });
  });

  it("returns unavailable for truncated model output", async () => {
    const { service, executor } = fixture({
      model: async () => ({ ...response, completion: "truncated", json: "{" }),
    });
    expect(await service.propose("Captured total")).toEqual({
      status: "unavailable",
      reason: "truncated",
      usage: knownUsage,
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it("keeps unknown usage explicit in the proposal and receipt", async () => {
    const { service, settleUsage } = fixture({
      model: async () => ({ ...response, usage: { kind: "unknown" } }),
    });
    expect(await service.propose("Captured total")).toMatchObject({
      status: "confirmation",
      usage: { kind: "unknown" },
    });
    expect(settleUsage).toHaveBeenCalledWith({
      invocationId: "invocation-1",
      usage: { kind: "unknown" },
      completion: "complete",
    });
  });

  it.each([
    { choiceIds: ["missing"] },
    { choiceIds: ["captures", "captures"] },
    { choiceIds: [42] },
  ])("rejects invalid choice selection %j after settling usage", async (selection) => {
    const { service, settleUsage } = fixture({
      model: async () => ({ ...response, json: JSON.stringify(selection) }),
    });
    await expect(service.propose("Captured total")).rejects.toMatchObject({
      code: "analytics-core/analysis-invalid-plan",
    });
    expect(settleUsage).toHaveBeenCalledOnce();
  });

  it("rejects an oversized model response after settling its usage", async () => {
    const { service, settleUsage } = fixture({
      model: async () => ({ ...response, json: "x".repeat(1_001) }),
    });
    await expect(service.propose("Captured total")).rejects.toMatchObject({
      code: "analytics-core/analysis-output-budget-exceeded",
    });
    expect(settleUsage).toHaveBeenCalledWith({
      invocationId: "invocation-1",
      usage: knownUsage,
      completion: "complete",
    });
  });

  it("rejects negative token counts without treating them as known usage", async () => {
    const { service, settleUsage } = fixture({
      model: async () => ({
        ...response,
        usage: { kind: "known", inputTokens: -1, outputTokens: 3 },
      }),
    });
    await expect(service.propose("Captured total")).rejects.toMatchObject({
      code: "analytics-core/analysis-invalid-usage",
    });
    expect(settleUsage).toHaveBeenCalledWith({
      invocationId: "invocation-1",
      usage: { kind: "unknown" },
      completion: "unknown",
    });
  });

  it("returns unavailable without model access when no definitions are authorized", async () => {
    const { service, state, model } = fixture();
    state.context = { ...context, allowedFields: [] };
    expect(await service.propose("Captured total")).toEqual({
      status: "unavailable",
      reason: "no-definitions",
      usage: { kind: "unknown" },
    });
    expect(model).not.toHaveBeenCalled();
  });

  it("blocks questions rejected by the application PII policy before model access", async () => {
    const { service, model } = fixture({ prepareQuestion: () => null });
    await expect(service.propose("customer@example.com")).rejects.toMatchObject({
      code: "analytics-core/analysis-question-blocked",
    });
    expect(model).not.toHaveBeenCalled();
  });

  it("passes only the policy-masked question to the model", async () => {
    const { service, model } = fixture({
      prepareQuestion: () => "Captured total for [masked customer]",
    });
    await service.propose("Captured total for customer@example.com");
    expect(model.mock.calls[0]?.[0].question).toBe("Captured total for [masked customer]");
    expect(JSON.stringify(model.mock.calls)).not.toContain("customer@example.com");
  });

  it("times out model inference and settles explicit unknown usage", async () => {
    vi.useFakeTimers();
    const pending = deferred<AnalysisModelResponse>();
    const { service, model, settleUsage } = fixture({ model: () => pending.promise });
    const proposal = service.propose("Captured total");
    const rejected = expect(proposal).rejects.toMatchObject({
      code: "analytics-core/analysis-cancelled",
    });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(model.mock.calls[0]?.[0].signal.aborted).toBe(true);
    expect(settleUsage).toHaveBeenCalledWith({
      invocationId: "invocation-1",
      usage: { kind: "unknown" },
      completion: "unknown",
    });
    pending.resolve(response);
  });

  it("rejects cancellation before calling the model", async () => {
    const { service, model } = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(service.propose("Captured total", controller.signal)).rejects.toMatchObject({
      code: "analytics-core/analysis-cancelled",
    });
    expect(model).not.toHaveBeenCalled();
  });

  it("retains the concurrency slot until a cancelled model call settles", async () => {
    const pending = deferred<AnalysisModelResponse>();
    const { service, model } = fixture({ model: () => pending.promise });
    const controller = new AbortController();
    const proposal = service.propose("Captured total", controller.signal);
    await vi.waitFor(() => expect(model).toHaveBeenCalledOnce());
    controller.abort();
    await expect(proposal).rejects.toMatchObject({ code: "analytics-core/analysis-cancelled" });
    await expect(service.propose("Captured total")).rejects.toMatchObject({
      code: "analytics-core/analysis-concurrency-exceeded",
    });
    pending.resolve(response);
    await pending.promise;
    expect(await service.propose("Captured total")).toMatchObject({ status: "confirmation" });
  });

  it("preserves partial report status without executing", async () => {
    const reviewed = report({
      result: { ...result, quality: { ...result.quality, temporalCompleteness: "partial" } },
    });
    const { service, executor } = fixture({ report: reviewed });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toEqual({ status: "partial" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("refreshes an expired report through the registered executor", async () => {
    const { service, executor } = fixture({
      report: report({ expiresAt: "2000-01-01T00:00:00.000Z" }),
    });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toMatchObject({
      status: "ready",
      answer: { source: "executor" },
    });
    expect(executor).toHaveBeenCalledOnce();
  });

  it("returns stale when the registered executor cannot supply fresh evidence", async () => {
    const { service } = fixture({
      result: { ...result, quality: { ...result.quality, freshness: "stale" } },
    });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toEqual({ status: "stale" });
  });

  it("represents a missing aggregate as null instead of zero", async () => {
    const { service } = fixture({ result: { ...result, data: { amount: null } } });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toMatchObject({
      status: "ready",
      answer: {
        availability: "missing",
        facts: [{ label: "Captured amount", value: null }],
      },
    });
  });

  it("retains provider causes privately while sanitizing the public Problem", async () => {
    const cause = new Error("provider token=private customer@example.com");
    const { service } = fixture({
      model: async () => {
        throw cause;
      },
    });
    const problem = await service.propose("Captured total").catch((error) => error);
    expect(problem).toBeInstanceOf(GrowthAnalysisProblem);
    expect(problem.cause).toBe(cause);
    expect(JSON.stringify(problem)).not.toContain("private");
    expect(JSON.stringify(problem)).not.toContain("customer@example.com");
    expect(problem.code).toBe("analytics-core/analysis-provider-failed");
  });

  it.each([
    { kind: "known", inputTokens: 20, outputTokens: 3 },
    { kind: "estimated", inputTokens: 20, outputTokens: 3 },
    { kind: "unknown" },
  ] satisfies AnalysisUsage[])(
    "resumes repeated receipt failures without repeating inference for $kind usage",
    async (usage) => {
      const sink = vi
        .fn<GrowthAnalysisServiceOptions["settleUsage"]>()
        .mockRejectedValueOnce(new Error("sink unavailable"))
        .mockRejectedValueOnce(new Error("sink still unavailable"))
        .mockResolvedValue(undefined);
      const { service, model, executor } = fixture({
        model: async () => ({ ...response, usage }),
        settleUsage: sink,
      });
      const first = await settlementFailure(service.propose("Captured total"));
      const second = await settlementFailure(first.resume());
      expect(await second.resume()).toMatchObject({ status: "confirmation", usage });
      expect(model).toHaveBeenCalledOnce();
      expect(executor).not.toHaveBeenCalled();
      expect(sink.mock.calls).toEqual(
        Array.from({ length: 3 }, () => [
          {
            invocationId: "invocation-1",
            usage,
            completion: "complete",
          },
        ]),
      );
    },
  );

  it("rechecks permissions before returning a recovered proposal", async () => {
    const sink = vi
      .fn<GrowthAnalysisServiceOptions["settleUsage"]>()
      .mockRejectedValueOnce(new Error("sink unavailable"))
      .mockResolvedValue(undefined);
    const { service, model, state } = fixture({ settleUsage: sink });
    const failure = await settlementFailure(service.propose("Captured total"));
    state.context = { ...context, allowedFields: [] };
    expect(await failure.resume()).toEqual({
      status: "unavailable",
      reason: "definitions-changed",
      usage: knownUsage,
    });
    expect(model).toHaveBeenCalledOnce();
  });
  it("accepts equivalent result definitions with different property order", async () => {
    const reordered = {
      sourceRefs: identity.sourceRefs,
      population: identity.population,
      unit: identity.unit,
      hash: identity.hash,
      version: identity.version,
      id: identity.id,
    };
    const { service } = fixture({ result: { ...result, definition: reordered } });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toMatchObject({
      status: "ready",
      answer: {
        facts: [{ label: "Captured amount", value: "9007199254740993" }],
        metricDefinition: identity,
      },
    });
  });

  it("accepts result definitions that retain registered definition metadata", async () => {
    const { service } = fixture({ result: { ...result, definition } });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toMatchObject({
      status: "ready",
      answer: {
        facts: [{ label: "Captured amount", value: "9007199254740993" }],
      },
    });
  });

  it("recovers failed-inference settlement before rethrowing the original provider problem", async () => {
    const cause = new Error("provider private detail");
    const sink = vi
      .fn<GrowthAnalysisServiceOptions["settleUsage"]>()
      .mockRejectedValueOnce(new Error("sink unavailable"))
      .mockRejectedValueOnce(new Error("sink still unavailable"))
      .mockResolvedValue(undefined);
    const { service, model, executor } = fixture({
      model: async () => {
        throw cause;
      },
      settleUsage: sink,
    });
    const first = await settlementFailure(service.propose("Captured total"));
    const second = await settlementFailure(first.resume());
    const problem = await second.resume().catch((error) => error);
    expect(problem).toBeInstanceOf(GrowthAnalysisProblem);
    expect(problem).toMatchObject({ code: "analytics-core/analysis-provider-failed", cause });
    expect(JSON.stringify(problem)).not.toContain("private detail");
    expect(model).toHaveBeenCalledOnce();
    expect(executor).not.toHaveBeenCalled();
    expect(sink.mock.calls).toEqual(
      Array.from({ length: 3 }, () => [
        {
          invocationId: "invocation-1",
          usage: { kind: "unknown" },
          completion: "unknown",
        },
      ]),
    );
  });

  it.each(["known", "estimated"] as const)(
    "settles %s usage before rejecting output above the token budget",
    async (kind) => {
      const usage = { kind, inputTokens: 20, outputTokens: 101 };
      const { service, settleUsage } = fixture({ model: async () => ({ ...response, usage }) });
      await expect(service.propose("Captured total")).rejects.toMatchObject({
        code: "analytics-core/analysis-output-budget-exceeded",
      });
      expect(settleUsage).toHaveBeenCalledWith({
        invocationId: "invocation-1",
        usage,
        completion: "complete",
      });
    },
  );
  it.each([
    { kind: "unknown", sensitive: "private-provider-detail" },
    { kind: "known", inputTokens: 20, outputTokens: 3, sensitive: "private-provider-detail" },
    { kind: "estimated", inputTokens: 20, outputTokens: 3, sensitive: "private-provider-detail" },
  ] satisfies (AnalysisUsage & { sensitive: string })[])(
    "rejects extra $kind usage fields without forwarding them into settlement",
    async (usage) => {
      const { service, settleUsage } = fixture({ model: async () => ({ ...response, usage }) });
      const problem = await service.propose("Captured total").catch((error) => error);
      expect(problem).toBeInstanceOf(GrowthAnalysisProblem);
      expect(problem.code).toBe("analytics-core/analysis-invalid-usage");
      expect(JSON.stringify(problem)).not.toContain("private-provider-detail");
      expect(settleUsage).toHaveBeenCalledWith({
        invocationId: "invocation-1",
        usage: { kind: "unknown" },
        completion: "unknown",
      });
    },
  );

  it.each([null, undefined])(
    "rejects %s model usage with a stable validation problem",
    async (usage) => {
      const { service, settleUsage } = fixture({
        model: async () =>
          ({
            ...response,
            usage,
          }) as unknown as AnalysisModelResponse,
      });
      await expect(service.propose("Captured total")).rejects.toMatchObject({
        code: "analytics-core/analysis-invalid-usage",
      });
      expect(settleUsage).toHaveBeenCalledWith({
        invocationId: "invocation-1",
        usage: { kind: "unknown" },
        completion: "unknown",
      });
    },
  );

  it("rejects invalid completion while settling validated usage with unknown completion", async () => {
    const { service, settleUsage } = fixture({
      model: async () =>
        ({
          ...response,
          completion: "private-provider-detail",
        }) as unknown as AnalysisModelResponse,
    });
    const problem = await service.propose("Captured total").catch((error) => error);
    expect(problem).toBeInstanceOf(GrowthAnalysisProblem);
    expect(problem.code).toBe("analytics-core/analysis-invalid-completion");
    expect(JSON.stringify(problem)).not.toContain("private-provider-detail");
    expect(settleUsage).toHaveBeenCalledWith({
      invocationId: "invocation-1",
      usage: knownUsage,
      completion: "unknown",
    });
  });

  it("executes an equivalent transported plan whose object keys were reordered", async () => {
    const { service, executor } = fixture();
    const plan = confirmedPlan(await service.propose("Captured total"));
    const transported = {
      coverage: plan.coverage,
      assumptions: plan.assumptions,
      metricDefinition: Object.fromEntries(Object.entries(plan.metricDefinition).reverse()),
      window: { to: plan.window.to, from: plan.window.from },
      parameters: plan.parameters,
      version: plan.version,
      queryId: plan.queryId,
      contextRef: plan.contextRef,
    } as AnalysisPlan;
    expect(await service.execute(transported)).toMatchObject({ status: "ready" });
    expect(executor).toHaveBeenCalledOnce();
  });

  it("rejects cyclic plan parameters with a stable validation problem before execution", async () => {
    const { service, executor } = fixture();
    const plan = confirmedPlan(await service.propose("Captured total"));
    const parameters: Record<string, unknown> = {};
    parameters.self = parameters;
    await expect(service.execute({ ...plan, parameters } as AnalysisPlan)).rejects.toMatchObject({
      code: "analytics-core/analysis-invalid-plan",
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it("rejects bigint plan parameters with a stable validation problem before execution", async () => {
    const { service, executor } = fixture();
    const plan = confirmedPlan(await service.propose("Captured total"));
    await expect(
      service.execute({ ...plan, parameters: BigInt(1) } as unknown as AnalysisPlan),
    ).rejects.toMatchObject({
      code: "analytics-core/analysis-invalid-plan",
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it.each([
    { completion: "refused", json: response.json, reason: "refused" },
    { completion: "complete", json: JSON.stringify({ choiceIds: [] }), reason: "unsupported" },
  ] as const)(
    "explains $reason proposals without querying",
    async ({ completion, json, reason }) => {
      const { service, executor } = fixture({
        model: async () => ({ ...response, completion, json }),
      });
      expect(await service.propose("Captured total")).toEqual({
        status: "unavailable",
        reason,
        usage: knownUsage,
      });
      expect(executor).not.toHaveBeenCalled();
    },
  );
  it("does not execute a newer query version than the confirmed registration", async () => {
    const { service, executor, reader } = fixture({ queryVersion: 2 });
    const plan = confirmedPlan(await service.propose("Captured total"));
    expect(await service.execute(plan)).toEqual({ status: "unavailable" });
    expect(executor).not.toHaveBeenCalled();
    expect(reader.readCandidates).not.toHaveBeenCalled();
  });

  it("enforces shared read concurrency for overlapping confirmed executions", async () => {
    const pending = deferred<MetricReadResult>();
    const { service, executor } = fixture({ executor: () => pending.promise });
    const plan = confirmedPlan(await service.propose("Captured total"));
    const first = service.execute(plan);
    await vi.waitFor(() => expect(executor).toHaveBeenCalledOnce());
    await expect(service.execute(plan)).rejects.toMatchObject({
      code: "metrics-core/concurrency-budget-exceeded",
    });
    pending.resolve(result);
    expect(await first).toMatchObject({ status: "ready" });
  });

  it.each([
    ["failed", "analytics-core/analysis-provider-failed"],
    ["cancelled", "analytics-core/analysis-cancelled"],
  ] as const)(
    "settles known usage for a %s provider response before throwing a sanitized problem",
    async (completion, code) => {
      const cause = new Error("private-provider-detail");
      const { service, settleUsage } = fixture({
        model: async () => ({ ...response, completion, cause }),
      });
      const problem = await service.propose("Captured total").catch((error) => error);
      expect(problem).toBeInstanceOf(GrowthAnalysisProblem);
      expect(problem).toMatchObject({ code, cause });
      expect(JSON.stringify(problem)).not.toContain("private-provider-detail");
      expect(settleUsage).toHaveBeenCalledWith({
        invocationId: "invocation-1",
        usage: knownUsage,
        completion,
      });
    },
  );
  describe("strict JSON plan parameters", () => {
    const nonJsonParameters: readonly [string, () => unknown][] = [
      ["NaN", () => Number.NaN],
      ["positive infinity", () => Number.POSITIVE_INFINITY],
      ["negative infinity", () => Number.NEGATIVE_INFINITY],
      ["undefined", () => undefined],
      ["function", () => () => null],
      ["symbol", () => Symbol("parameter")],
      ["Date", () => new Date("2026-09-01T00:00:00.000Z")],
      ["custom prototype", () => Object.create({ inherited: true }) as unknown],
      ["sparse array", () => new Array(1)],
      ["accessor", () => Object.defineProperty({}, "value", { enumerable: true, get: () => null })],
      ["symbol key", () => ({ [Symbol("parameter")]: null })],
      [
        "non-enumerable property",
        () => Object.defineProperty({}, "value", { enumerable: false, value: null }),
      ],
    ];

    it.each(nonJsonParameters)(
      "rejects direct execution with a nested %s parameter before a common read",
      async (_label, parameter) => {
        const { service, executor, reader } = fixture({
          registrations: [{ ...registration, parameters: { value: null } }],
        });
        const plan = confirmedPlan(await service.propose("Captured total"));
        const invalid = { ...plan, parameters: { value: parameter() } } as unknown as AnalysisPlan;
        await expect(service.execute(invalid)).rejects.toMatchObject({
          code: "analytics-core/analysis-invalid-plan",
        });
        expect(reader.readCandidates).not.toHaveBeenCalled();
        expect(executor).not.toHaveBeenCalled();
      },
    );

    it.each(nonJsonParameters)(
      "rejects a trusted registration with a nested %s parameter before model access",
      async (_label, parameter) => {
        const invalidRegistration = {
          ...registration,
          parameters: { value: parameter() },
        } as unknown as AnalysisRegistration;
        const { service, model, reader, executor } = fixture({
          registrations: [invalidRegistration],
        });
        await expect(service.propose("Captured total")).rejects.toBeInstanceOf(
          GrowthAnalysisProblem,
        );
        expect(model).not.toHaveBeenCalled();
        expect(reader.readCandidates).not.toHaveBeenCalled();
        expect(executor).not.toHaveBeenCalled();
      },
    );
  });
});
