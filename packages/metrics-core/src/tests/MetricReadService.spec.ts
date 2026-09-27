import { describe, expect, it, vi } from "vitest";
import { ProblemCategory } from "@croco/problems-core";
import { MetricReadProblem, MetricReadService } from "../libs/read/MetricReadService";
import type {
  MetricReadAuthority,
  MetricReadContext,
  MetricReadResult,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  VerifiedMetricReport,
  VerifiedReportReader,
} from "../libs/read/MetricReadService";

const window = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-02T00:00:00.000Z" };
const definition: RegisteredMetricDefinition = {
  id: "captures_total",
  version: 1,
  hash: "sha256:defined",
  unit: "minor-USD",
  population: "paid-captures",
  sourceRefs: ["captures"],
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
const quality = {
  temporalCompleteness: "complete",
  freshness: "fresh",
  populationCoverage: "complete",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
} as const;
const result: MetricReadResult = {
  data: [{ amount: "9007199254740993" }],
  principal: context.principal,
  definition,
  unit: definition.unit,
  population: definition.population,
  filter: "currency=USD",
  fieldRefs: ["amountMinor"],
  window,
  sourceRevisions: context.sourceRevisions,
  snapshotRefs: ["snapshot-1"],
  quality,
  diagnostics: [],
  rows: 1,
  bytes: 50,
  cost: 1,
};

function fixture(
  options: {
    report?: VerifiedMetricReport;
    verified?: boolean;
    reader?: VerifiedReportReader;
    query?: Partial<RegisteredMetricQuery>;
    definition?: RegisteredMetricDefinition;
    grant?: MetricReadAuthority["authorize"];
    executor?: RegisteredMetricQuery["readExecutor"];
    context?: MetricReadContext;
  } = {},
) {
  const executor = vi.fn(options.executor ?? (async () => result));
  const query: RegisteredMetricQuery = {
    id: "captures_by_currency",
    version: 1,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: "currency=USD",
    requiredFields: ["amountMinor"],
    requiresRaw: false,
    limits: { ...context.budget },
    inputSchema: {
      parse: (input) => {
        if (
          typeof input !== "object" ||
          input === null ||
          !("currency" in input) ||
          input.currency !== "USD"
        ) {
          throw new MetricReadProblem(
            "metrics-core/invalid-query-input",
            ProblemCategory.ValidationError,
            "USD is required",
          );
        }
        return input;
      },
    },
    outputSchema: { parse: (output) => output },
    inputKey: () => "USD",
    readExecutor: executor,
    ...options.query,
  };
  const authority: MetricReadAuthority = {
    currentContext: () => options.context ?? context,
    authorize:
      options.grant ??
      (async () => ({ permissionEpoch: "permission-1", privacyEpoch: "privacy-1" })),
  };
  const reader: VerifiedReportReader = {
    readCandidates: vi.fn(async () => (options.report ? [options.report] : [])),
    verify: vi.fn(async () => options.verified ?? true),
  };
  return {
    service: new MetricReadService(
      [options.definition ?? definition],
      [query],
      authority,
      options.reader ?? reader,
    ),
    executor,
    reader,
  };
}

function report(overrides: Partial<VerifiedMetricReport> = {}): VerifiedMetricReport {
  return {
    id: "reviewed-report",
    queryId: "captures_by_currency",
    queryVersion: 1,
    inputKey: "USD",
    resultHash: "sha256:result",
    result,
    reviewed: {
      reviewerId: "reviewer-1",
      reviewedAt: "2026-09-02T00:00:00.000Z",
      definitionHash: definition.hash,
      resultHash: "sha256:result",
    },
    permissionEpoch: "permission-1",
    privacyEpoch: "privacy-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MetricReadService", () => {
  it("returns an exact reviewed report without executing a query", async () => {
    const { service, executor } = fixture({ report: report() });
    const answer = await service.runRegisteredQuery(
      "captures_by_currency",
      { currency: "USD" },
      window,
    );
    expect(answer).toEqual({ status: "verified", source: "report", result });
    expect(executor).not.toHaveBeenCalled();
    expect(service.getAuditEvents()).toEqual([
      {
        queryId: "captures_by_currency",
        sourceRefs: ["captures"],
        at: expect.any(String),
        status: "verified",
      },
    ]);
  });

  it("validates reviewed report data against the registered output schema", async () => {
    const invalidOutput = new MetricReadProblem(
      "metrics-core/invalid-query-output",
      ProblemCategory.InternalServerError,
      "Report data does not match the registered output",
    );
    const { service, executor } = fixture({
      report: report({ result: { ...result, data: { unexpected: true } } }),
      query: {
        outputSchema: {
          parse(output) {
            if (!Array.isArray(output)) throw invalidOutput;
            return output;
          },
        },
      },
    });

    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toBe(invalidOutput);
    expect(executor).not.toHaveBeenCalled();
  });

  it("rejects a report whose actual payload fails trusted review verification", async () => {
    const { service, executor } = fixture({ report: report(), verified: false });
    expect(
      await service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "unavailable" });
    expect(
      (await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window))
        .status,
    ).toBe("verified");
    expect(executor).toHaveBeenCalledOnce();
  });

  it.each([
    ["definition hash", { result: { ...result, definition: { ...definition, hash: "other" } } }],
    ["period", { result: { ...result, window: { ...window, to: "2026-09-03T00:00:00.000Z" } } }],
    ["population", { result: { ...result, population: "all-captures" } }],
    ["filter", { result: { ...result, filter: "currency=EUR" } }],
    [
      "source revision",
      { result: { ...result, sourceRevisions: [{ sourceRef: "captures", revision: "old" }] } },
    ],
    ["snapshot reference", { result: { ...result, snapshotRefs: ["old"] } }],
    ["field reference", { result: { ...result, fieldRefs: ["other"] } }],
    [
      "review hash",
      {
        reviewed: {
          reviewerId: "reviewer-1",
          reviewedAt: "2026-09-02T00:00:00.000Z",
          definitionHash: definition.hash,
          resultHash: "other",
        },
      },
    ],
  ])("does not adopt a report with a different %s", async (_label, overrides) => {
    const { service, executor } = fixture({ report: report(overrides) });
    expect(
      await service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "unavailable" });
    expect(
      (await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window))
        .status,
    ).toBe("verified");
    expect(executor).toHaveBeenCalledOnce();
  });

  it("does not reuse a report for another principal even when revisions and epochs match", async () => {
    const otherContext = {
      ...context,
      principal: { ...context.principal, tenant: "tenant-2", subject: "user-2" },
    };
    const otherResult = { ...result, principal: otherContext.principal };
    const { service, executor, reader } = fixture({
      context: otherContext,
      report: report(),
      executor: async () => otherResult,
    });
    expect(
      await service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "unavailable" });
    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "verified", source: "executor", result: otherResult });
    expect(executor).toHaveBeenCalledOnce();
    expect(reader.verify).not.toHaveBeenCalled();
    expect(reader.readCandidates).toHaveBeenCalledWith(
      "captures_by_currency",
      "USD",
      otherContext.principal,
      expect.any(AbortSignal),
    );
  });

  it("rejects an executor result for a different principal", async () => {
    const otherPrincipal = { ...context.principal, tenant: "tenant-2" };
    const { service } = fixture({
      executor: async () => ({ ...result, principal: otherPrincipal }),
    });
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/result-contract-mismatch" });
  });

  it("marks a report with an invalid expiry as stale", async () => {
    const { service, executor } = fixture({ report: report({ expiresAt: "not-a-date" }) });
    expect(
      await service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({
      status: "stale",
      reportId: "reviewed-report",
      evidence: expect.objectContaining({ definition }),
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it("reports partial, stale, and permission mismatches explicitly", async () => {
    const partial = fixture({
      report: report({
        result: { ...result, quality: { ...quality, temporalCompleteness: "partial" } },
      }),
    });
    expect(
      await partial.service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({
      status: "partial",
      reportId: "reviewed-report",
      evidence: expect.objectContaining({
        definition,
        quality: expect.objectContaining({ temporalCompleteness: "partial" }),
        snapshotRefs: ["snapshot-1"],
      }),
    });
    expect(
      (
        await partial.service.runRegisteredQuery(
          "captures_by_currency",
          { currency: "USD" },
          window,
        )
      ).status,
    ).toBe("partial");
    expect(partial.executor).not.toHaveBeenCalled();

    const stale = fixture({ report: report({ expiresAt: "2000-01-01T00:00:00.000Z" }) });
    expect(
      await stale.service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({
      status: "stale",
      reportId: "reviewed-report",
      evidence: expect.objectContaining({ definition }),
    });

    const denied = fixture({ report: report({ privacyEpoch: "old" }) });
    expect(
      await denied.service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({
      status: "denied",
      reportId: "reviewed-report",
    });
  });

  it("discards partial report evidence when privacy changes during review verification", async () => {
    let privacyEpoch = "privacy-1";
    const partialReport = report({
      result: { ...result, quality: { ...quality, populationCoverage: "partial" } },
    });
    const reader: VerifiedReportReader = {
      readCandidates: vi.fn(async () => [partialReport]),
      verify: vi.fn(async () => {
        privacyEpoch = "privacy-2";
        return true;
      }),
    };
    const { service, executor } = fixture({
      reader,
      grant: async () => ({ permissionEpoch: "permission-1", privacyEpoch }),
    });
    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "denied" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("returns authorized partial evidence without raw data or principal", async () => {
    const { service } = fixture({
      executor: async () => ({
        ...result,
        quality: { ...quality, populationCoverage: "partial" },
        diagnostics: ["source-coverage-partial"],
      }),
    });
    const outcome = await service.runRegisteredQuery(
      "captures_by_currency",
      { currency: "USD" },
      window,
    );
    expect(outcome.status).toBe("partial");
    if (outcome.status !== "partial") throw new Error("Expected partial metric evidence");
    expect(outcome.evidence).toMatchObject({
      definition,
      fieldRefs: ["amountMinor"],
      snapshotRefs: ["snapshot-1"],
      quality: { populationCoverage: "partial" },
      diagnostics: ["source-coverage-partial"],
    });
    expect(outcome.evidence).not.toHaveProperty("data");
    expect(outcome.evidence).not.toHaveProperty("principal");
  });

  it("enforces field permission, window, result, and concurrent budgets", async () => {
    const noField = fixture({ context: { ...context, allowedFields: [] } });
    expect(
      (
        await noField.service.runRegisteredQuery(
          "captures_by_currency",
          { currency: "USD" },
          window,
        )
      ).status,
    ).toBe("denied");
    expect(noField.executor).not.toHaveBeenCalled();

    const overWindow = fixture({
      context: { ...context, budget: { ...context.budget, maxWindowMs: 1 } },
    });
    await expect(
      overWindow.service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/window-budget-exceeded" });

    const overRows = fixture({ executor: async () => ({ ...result, rows: 11 }) });
    await expect(
      overRows.service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/result-budget-exceeded" });

    let release!: () => void;
    const pending = new Promise<MetricReadResult>((resolve) => {
      release = () => resolve(result);
    });
    const concurrent = fixture({ executor: async () => pending });
    const first = concurrent.service.runRegisteredQuery(
      "captures_by_currency",
      { currency: "USD" },
      window,
    );
    await vi.waitFor(() => expect(concurrent.executor).toHaveBeenCalledOnce());
    await expect(
      concurrent.service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/concurrency-budget-exceeded" });
    release();
    expect((await first).status).toBe("verified");
  });

  it("cancels before execution and while the executor is pending", async () => {
    const preCancelled = new AbortController();
    preCancelled.abort();
    const before = fixture({ context: { ...context, signal: preCancelled.signal } });
    await expect(
      before.service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    expect(before.executor).not.toHaveBeenCalled();

    const controller = new AbortController();
    const during = fixture({
      context: { ...context, signal: controller.signal },
      executor: async () => new Promise<MetricReadResult>(() => undefined),
    });
    const pending = during.service.runRegisteredQuery(
      "captures_by_currency",
      { currency: "USD" },
      window,
    );
    await vi.waitFor(() => expect(during.executor).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
  });

  it("holds the concurrency slot until a cancelled executor settles", async () => {
    const controller = new AbortController();
    let release!: () => void;
    const execution = new Promise<MetricReadResult>((resolve) => {
      release = () => resolve(result);
    });
    const currentContext = { ...context, signal: controller.signal };
    const { service, executor } = fixture({
      context: currentContext,
      executor: async () => execution,
    });
    const first = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window);
    await vi.waitFor(() => expect(executor).toHaveBeenCalledOnce());
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    currentContext.signal = new AbortController().signal;
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/concurrency-budget-exceeded" });
    release();
    await vi.waitFor(() => expect(executor).toHaveBeenCalledOnce());
    expect(
      (await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window))
        .status,
    ).toBe("verified");
  });

  it("uses one time budget across report lookup and executor execution", async () => {
    vi.useFakeTimers();
    try {
      const slowReader: VerifiedReportReader = {
        readCandidates: vi.fn(
          async () =>
            new Promise<readonly VerifiedMetricReport[]>((resolve) =>
              setTimeout(() => resolve([]), 75),
            ),
        ),
        verify: vi.fn(async () => true),
      };
      const { service, executor } = fixture({
        reader: slowReader,
        query: { limits: { ...context.budget, maxTimeMs: 100 } },
        executor: async () =>
          new Promise<MetricReadResult>((resolve) => setTimeout(() => resolve(result), 75)),
      });
      const read = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window);
      const rejected = expect(read).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
      await vi.advanceTimersByTimeAsync(75);
      expect(executor).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(25);
      await rejected;
      await vi.advanceTimersByTimeAsync(50);
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes the stricter query limits to the registered executor", async () => {
    const smaller = { ...context, budget: { ...context.budget, maxRows: 100 } };
    const { service, executor } = fixture({ context: smaller });
    await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window);
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ budget: expect.objectContaining({ maxRows: 10 }) }),
      }),
    );
  });

  it("bounds report reads and retains their slot after cancellation until the reader settles", async () => {
    const controller = new AbortController();
    let release!: () => void;
    const pending = new Promise<readonly VerifiedMetricReport[]>((resolve) => {
      release = () => resolve([]);
    });
    const reader: VerifiedReportReader = {
      readCandidates: vi.fn(async () => pending),
      verify: vi.fn(async () => true),
    };
    const currentContext = { ...context, signal: controller.signal };
    const { service } = fixture({ context: currentContext, reader });
    const first = service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window);
    await vi.waitFor(() => expect(reader.readCandidates).toHaveBeenCalledOnce());
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    currentContext.signal = new AbortController().signal;
    await expect(
      service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/concurrency-budget-exceeded" });
    release();
    await Promise.resolve();
    expect(
      await service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "unavailable" });
  });

  it("discards output when the permission or privacy epoch changes before return", async () => {
    let permission = "permission-1";
    const { service } = fixture({
      grant: async () => ({ permissionEpoch: permission, privacyEpoch: "privacy-1" }),
      executor: async () => {
        permission = "permission-2";
        return result;
      },
    });
    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "denied" });
  });

  it("rejects free-form diagnostics from an executor", async () => {
    const { service } = fixture({
      executor: async () => ({ ...result, diagnostics: ["customer@example.com"] }),
    });
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/invalid-diagnostics" });
  });

  it("only exposes authorized definitions", async () => {
    const { service } = fixture({ context: { ...context, allowedFields: [] } });
    expect(await service.listDefinitions()).toEqual([]);
    expect(await service.explainDefinition("captures_total")).toEqual({ status: "denied" });
  });

  it.each([
    ["multiple definitions", { definitionRefs: [definition.id, definition.id] }],
    ["missing field permission", { requiredFields: [] }],
    ["unit mismatch", { unit: "EUR" }],
    ["population mismatch", { population: "other" }],
  ])("rejects registration with %s", (_label, query) => {
    expect(() => fixture({ query })).toThrowError(MetricReadProblem);
  });

  it("rejects a query that omits a definition's raw-read requirement", () => {
    expect(() => fixture({ definition: { ...definition, requiresRaw: true } })).toThrowError(
      MetricReadProblem,
    );
  });
});
