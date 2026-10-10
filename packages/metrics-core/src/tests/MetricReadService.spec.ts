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
    query,
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
  it.each(["report", "query"] as const)(
    "sanitizes registered schema failures for %s input",
    async (kind) => {
      const privateError = new Error("private customer secret in schema failure");
      const { service, executor, reader } = fixture({
        query: {
          inputSchema: {
            parse: () => {
              throw privateError;
            },
          },
        },
      });
      const pending =
        kind === "report"
          ? service.getVerifiedReport("captures_by_currency", { currency: "USD" }, window)
          : service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window);
      await expect(pending).rejects.toMatchObject({
        code: "metrics-core/invalid-query-input",
        category: ProblemCategory.ValidationError,
        detail: "Metric query input does not match its registered schema",
      });
      await expect(pending).rejects.not.toBe(privateError);
      await expect(pending).rejects.toHaveProperty("cause", undefined);
      expect(executor).not.toHaveBeenCalled();
      expect(reader.readCandidates).not.toHaveBeenCalled();
    },
  );

  it("awaits the asynchronous input key before looking up reviewed reports", async () => {
    let releaseKey!: (key: string) => void;
    const key = new Promise<string>((resolve) => {
      releaseKey = resolve;
    });
    const inputKey = vi.fn(async () => key);
    const { service, reader, executor } = fixture({ query: { inputKey }, report: report() });
    const pending = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window);
    await vi.waitFor(() => expect(inputKey).toHaveBeenCalledOnce());
    expect(reader.readCandidates).not.toHaveBeenCalled();
    releaseKey("USD");
    await expect(pending).resolves.toEqual({ status: "verified", source: "report", result });
    expect(reader.readCandidates).toHaveBeenCalledWith(
      "captures_by_currency",
      "USD",
      context.principal,
      expect.any(AbortSignal),
    );
    expect(executor).not.toHaveBeenCalled();
  });

  it("never looks up reports after an asynchronous input key exceeds the deadline", async () => {
    vi.useFakeTimers();
    try {
      let releaseKey!: (key: string) => void;
      const key = new Promise<string>((resolve) => {
        releaseKey = resolve;
      });
      const inputKey = vi.fn(async () => key);
      const { service, reader, executor } = fixture({
        query: { inputKey, limits: { ...context.budget, maxTimeMs: 100 } },
        report: report(),
      });
      const pending = service.runRegisteredQuery(
        "captures_by_currency",
        { currency: "USD" },
        window,
      );
      const rejected = expect(pending).rejects.toMatchObject({
        code: "metrics-core/read-timeout",
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(inputKey).toHaveBeenCalledOnce();
      await rejected;
      releaseKey("USD");
      await vi.advanceTimersByTimeAsync(0);
      expect(reader.readCandidates).not.toHaveBeenCalled();
      expect(executor).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["executor", "report"] as const)(
    "discards opted-in partial %s data after a privacy epoch change",
    async (source) => {
      let privacyEpoch = "privacy-1";
      const partialResult = {
        ...result,
        quality: { ...quality, populationCoverage: "partial" as const },
      };
      const partialReport = report({ result: partialResult });
      const { service } = fixture({
        query: { partialDataPolicy: "authorized" },
        grant: async () => ({ permissionEpoch: "permission-1", privacyEpoch }),
        executor: async () => {
          privacyEpoch = "privacy-2";
          return partialResult;
        },
        ...(source === "report"
          ? {
              reader: {
                readCandidates: async () => [partialReport],
                verify: async () => {
                  privacyEpoch = "privacy-2";
                  return true;
                },
              },
            }
          : {}),
      });
      await expect(
        service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
      ).resolves.toEqual({ status: "denied" });
    },
  );

  it("rejects opted-in partial executor data exceeding the row budget", async () => {
    const { service } = fixture({
      query: { partialDataPolicy: "authorized" },
      executor: async () => ({
        ...result,
        rows: 11,
        quality: { ...quality, populationCoverage: "partial" },
      }),
    });
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/result-budget-exceeded" });
  });

  it.each(["executor", "report"] as const)(
    "withholds partial %s data by default",
    async (source) => {
      const partialResult = {
        ...result,
        quality: { ...quality, populationCoverage: "partial" as const },
      };
      const { service } = fixture({
        executor: async () => partialResult,
        ...(source === "report" ? { report: report({ result: partialResult }) } : {}),
      });
      const answer = await service.runRegisteredQuery(
        "captures_by_currency",
        { currency: "USD" },
        window,
      );
      expect(answer.status).toBe("partial");
      expect(answer).not.toHaveProperty("result");
      expect(answer).not.toHaveProperty("evidence.data");
    },
  );

  it.each(["executor", "report"] as const)(
    "returns opted-in partial %s totals and quality",
    async (source) => {
      const partialResult = {
        ...result,
        quality: { ...quality, populationCoverage: "partial" as const },
      };
      const { service } = fixture({
        query: { partialDataPolicy: "authorized" },
        executor: async () => partialResult,
        ...(source === "report" ? { report: report({ result: partialResult }) } : {}),
      });
      await expect(
        service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
      ).resolves.toMatchObject({ status: "partial", result: partialResult });
    },
  );

  it.each(["executor", "report"] as const)(
    "withholds stale %s data even when partial data is authorized",
    async (source) => {
      const staleResult = {
        ...result,
        quality: {
          ...quality,
          freshness: "stale" as const,
          populationCoverage: "partial" as const,
        },
      };
      const { service } = fixture({
        query: { partialDataPolicy: "authorized" },
        executor: async () => staleResult,
        ...(source === "report" ? { report: report({ result: staleResult }) } : {}),
      });
      const answer = await service.runRegisteredQuery(
        "captures_by_currency",
        { currency: "USD" },
        window,
      );
      expect(answer.status).toBe("stale");
      expect(answer).not.toHaveProperty("result");
      expect(answer).not.toHaveProperty("evidence.data");
    },
  );

  it.each(["executor", "report"] as const)(
    "discards opted-in partial %s data after permission revocation",
    async (source) => {
      let allowed = true;
      const partialResult = {
        ...result,
        quality: { ...quality, populationCoverage: "partial" as const },
      };
      const partialReport = report({ result: partialResult });
      const { service } = fixture({
        query: { partialDataPolicy: "authorized" },
        grant: async () =>
          allowed ? { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" } : null,
        executor: async () => {
          allowed = false;
          return partialResult;
        },
        ...(source === "report"
          ? {
              reader: {
                readCandidates: async () => [partialReport],
                verify: async () => {
                  allowed = false;
                  return true;
                },
              },
            }
          : {}),
      });
      await expect(
        service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
      ).resolves.toEqual({ status: "denied" });
    },
  );

  it.each(["executor", "report"] as const)(
    "validates opted-in partial %s output before returning data",
    async (source) => {
      const partialResult = {
        ...result,
        quality: { ...quality, populationCoverage: "partial" as const },
      };
      const invalidOutput = new MetricReadProblem(
        "metrics-core/invalid-query-output",
        ProblemCategory.InternalServerError,
        "Invalid output",
      );
      const { service } = fixture({
        query: {
          partialDataPolicy: "authorized",
          outputSchema: {
            parse: () => {
              throw invalidOutput;
            },
          },
        },
        executor: async () => partialResult,
        ...(source === "report" ? { report: report({ result: partialResult }) } : {}),
      });
      await expect(
        service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
      ).rejects.toBe(invalidOutput);
    },
  );

  it("denies an opted-in partial report that exceeds the row budget", async () => {
    const { service, executor } = fixture({
      query: { partialDataPolicy: "authorized" },
      report: report({
        result: { ...result, rows: 11, quality: { ...quality, populationCoverage: "partial" } },
      }),
    });
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).resolves.toEqual({ status: "denied", reportId: "reviewed-report" });
    expect(executor).not.toHaveBeenCalled();
  });

  it("scopes revisions and snapshots to each registered definition", async () => {
    const sharedContext: MetricReadContext = {
      ...context,
      sourceRevisions: [
        { sourceRef: "refunds", revision: "refunds-2" },
        { sourceRef: "captures", revision: "snapshot-1" },
      ],
      snapshotRefs: ["refunds-snapshot-2", "snapshot-1"],
    };
    const refundsDefinition: RegisteredMetricDefinition = {
      ...definition,
      id: "refunds_total",
      hash: "sha256:refunds",
      sourceRefs: ["refunds"],
    };
    const refundsResult: MetricReadResult = {
      ...result,
      definition: refundsDefinition,
      sourceRevisions: [{ sourceRef: "refunds", revision: "refunds-2" }],
      snapshotRefs: ["refunds-snapshot-2"],
    };
    const { query, reader } = fixture({ report: report() });
    const refundsExecutor = vi.fn(async ({ context: readContext }) => {
      expect(readContext.sourceRevisions).toEqual(refundsResult.sourceRevisions);
      expect(readContext.snapshotRefs).toEqual(refundsResult.snapshotRefs);
      return refundsResult;
    });
    const service = new MetricReadService(
      [definition, refundsDefinition],
      [
        query,
        {
          ...query,
          id: "refunds_by_currency",
          definitionRefs: [refundsDefinition.id],
          readExecutor: refundsExecutor,
        },
      ],
      {
        currentContext: () => sharedContext,
        authorize: async () => ({ permissionEpoch: "permission-1", privacyEpoch: "privacy-1" }),
      },
      reader,
    );

    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "verified", source: "report", result });
    expect(
      await service.runRegisteredQuery("refunds_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "verified", source: "executor", result: refundsResult });
    expect(refundsExecutor).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "missing required source",
      {
        sourceRevisions: [{ sourceRef: "refunds", revision: "refunds-2" }],
        snapshotRefs: ["refunds-2"],
      },
      "metrics-core/source-revision-missing",
    ],
    [
      "unaligned snapshots",
      { sourceRevisions: context.sourceRevisions, snapshotRefs: [] },
      "metrics-core/invalid-read-context",
    ],
  ])("rejects %s before executing", async (_label, sources, code) => {
    const { service, executor } = fixture({ context: { ...context, ...sources } });
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code });
    expect(executor).not.toHaveBeenCalled();
  });

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

  it.each(["list", "queries", "explain", "report", "query"] as const)(
    "cancels a pending %s authorization using the invocation signal",
    async (method) => {
      let scopedSignal: AbortSignal | undefined;
      const grant = vi.fn(async (request: MetricReadContext) => {
        scopedSignal = request.signal;
        return new Promise<null>(() => undefined);
      });
      const { service, executor } = fixture({ grant });
      const controller = new AbortController();
      const pending =
        method === "list"
          ? service.listDefinitions(controller.signal)
          : method === "queries"
            ? service.listRegisteredQueries(controller.signal)
            : method === "explain"
              ? service.explainDefinition(definition.id, controller.signal)
              : method === "report"
                ? service.getVerifiedReport(
                    "captures_by_currency",
                    { currency: "USD" },
                    window,
                    controller.signal,
                  )
                : service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
                    signal: controller.signal,
                  });
      const rejected = expect(pending).rejects.toMatchObject({
        code: "metrics-core/read-cancelled",
      });
      await vi.waitFor(() => expect(grant).toHaveBeenCalledOnce());
      controller.abort();
      await rejected;
      expect(scopedSignal?.aborted).toBe(true);
      expect(scopedSignal?.reason).toMatchObject({ code: "metrics-core/read-cancelled" });
      expect(executor).not.toHaveBeenCalled();
    },
  );

  it.each(["trusted", "invocation"] as const)(
    "merges the %s cancellation signal without replacing authority",
    async (source) => {
      const trusted = new AbortController();
      const invocation = new AbortController();
      const { service, executor } = fixture({
        context: { ...context, signal: trusted.signal },
        executor: async () => new Promise<MetricReadResult>(() => undefined),
      });
      const pending = service.runRegisteredQuery(
        "captures_by_currency",
        { currency: "USD" },
        window,
        { signal: invocation.signal },
      );
      const rejected = expect(pending).rejects.toMatchObject({
        code: "metrics-core/read-cancelled",
      });
      await vi.waitFor(() => expect(executor).toHaveBeenCalledOnce());
      expect(executor.mock.calls[0]?.[0].context.principal).toEqual(context.principal);
      (source === "trusted" ? trusted : invocation).abort();
      await rejected;
      expect(executor.mock.calls[0]?.[0].signal.aborted).toBe(true);
      expect(source === "trusted" ? invocation.signal.aborted : trusted.signal.aborted).toBe(false);
    },
  );

  it.each(["lookup", "verification"] as const)(
    "cancels report %s with the invocation signal",
    async (stage) => {
      const controller = new AbortController();
      const reader: VerifiedReportReader = {
        readCandidates: vi.fn(async () =>
          stage === "lookup"
            ? new Promise<readonly VerifiedMetricReport[]>(() => undefined)
            : [report()],
        ),
        verify: vi.fn(async () => new Promise<boolean>(() => undefined)),
      };
      const { service, executor } = fixture({ reader });
      const pending = service.getVerifiedReport(
        "captures_by_currency",
        { currency: "USD" },
        window,
        controller.signal,
      );
      const rejected = expect(pending).rejects.toMatchObject({
        code: "metrics-core/read-cancelled",
      });
      await vi.waitFor(() =>
        expect(stage === "lookup" ? reader.readCandidates : reader.verify).toHaveBeenCalledOnce(),
      );
      controller.abort();
      await rejected;
      expect(executor).not.toHaveBeenCalled();
    },
  );

  it("normalizes an authority's abort rejection", async () => {
    const controller = new AbortController();
    const { service } = fixture({
      grant: async (readContext) =>
        new Promise((_, reject) => {
          readContext.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    });
    const pending = service.listDefinitions(controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    controller.abort();
    await rejected;
  });

  it("isolates invocation cancellation and retains the shared concurrency budget", async () => {
    const controller = new AbortController();
    const budget = { ...context.budget, maxConcurrency: 2 };
    const releases: (() => void)[] = [];
    const { service, executor } = fixture({
      context: { ...context, budget },
      query: { limits: budget },
      executor: async () =>
        new Promise<MetricReadResult>((resolve) => releases.push(() => resolve(result))),
    });
    const first = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
      signal: controller.signal,
    });
    const rejected = expect(first).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    await vi.waitFor(() => expect(executor).toHaveBeenCalledTimes(1));
    const second = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window);
    await vi.waitFor(() => expect(executor).toHaveBeenCalledTimes(2));
    controller.abort();
    await rejected;
    expect(executor.mock.calls[1]?.[0].signal.aborted).toBe(false);
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/concurrency-budget-exceeded" });
    releases[1]?.();
    expect((await second).status).toBe("verified");
    releases[0]?.();
  });

  it.each(["authorization", "report"] as const)(
    "classifies a stalled %s as a timeout",
    async (stage) => {
      vi.useFakeTimers();
      try {
        const { service } = fixture({
          query: { limits: { ...context.budget, maxTimeMs: 100 } },
          ...(stage === "authorization"
            ? { grant: async () => new Promise<null>(() => undefined) }
            : {
                reader: {
                  readCandidates: async () =>
                    new Promise<readonly VerifiedMetricReport[]>(() => undefined),
                  verify: async () => true,
                },
              }),
        });
        const pending = service.getVerifiedReport(
          "captures_by_currency",
          { currency: "USD" },
          window,
        );
        const rejected = expect(pending).rejects.toMatchObject({
          code: "metrics-core/read-timeout",
        });
        await vi.advanceTimersByTimeAsync(100);
        await rejected;
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each([
    ["definitions", "initial"],
    ["definitions", "recheck"],
    ["queries", "initial"],
    ["queries", "recheck"],
    ["explanation", "initial"],
    ["explanation", "recheck"],
    ["report", "initial"],
    ["report", "recheck"],
    ["execution", "initial"],
    ["execution", "recheck"],
  ] as const)(
    "aborts %s %s authorization at the remaining deadline without aborting its caller",
    async (kind, stage) => {
      vi.useFakeTimers();
      try {
        const caller = new AbortController();
        const signals: AbortSignal[] = [];
        const grant = vi.fn(async (request: MetricReadContext) => {
          const signal = request.signal;
          if (!signal) throw new Error("Authorization requires a scoped signal");
          signals.push(signal);
          if (stage === "recheck" && signals.length === 1) {
            await new Promise<void>((resolve) => setTimeout(resolve, 60));
            return { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" };
          }
          return new Promise<null>((_, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              {
                once: true,
              },
            );
          });
        });
        const { service } = fixture({
          context: {
            ...context,
            budget: {
              ...context.budget,
              maxTimeMs: kind === "report" || kind === "execution" ? 1_000 : 100,
            },
          },
          query: { limits: { ...context.budget, maxTimeMs: 100 } },
          grant,
        });
        const pending =
          kind === "definitions"
            ? service.listDefinitions(caller.signal)
            : kind === "queries"
              ? service.listRegisteredQueries(caller.signal)
              : kind === "explanation"
                ? service.explainDefinition(definition.id, caller.signal)
                : kind === "report"
                  ? service.getVerifiedReport(
                      "captures_by_currency",
                      { currency: "USD" },
                      window,
                      caller.signal,
                    )
                  : service.runRegisteredQuery(
                      "captures_by_currency",
                      { currency: "USD" },
                      window,
                      { signal: caller.signal },
                    );
        const rejected = expect(pending).rejects.toMatchObject({
          code: "metrics-core/read-timeout",
        });
        await vi.advanceTimersByTimeAsync(60);
        expect(grant).toHaveBeenCalledTimes(stage === "initial" ? 1 : 2);
        await vi.advanceTimersByTimeAsync(40);
        await rejected;
        expect(signals.at(-1)?.aborted).toBe(true);
        expect(signals.at(-1)?.reason).toMatchObject({ code: "metrics-core/read-timeout" });
        expect(caller.signal.aborted).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("cleans up authorization timers and caller listeners after success", async () => {
    vi.useFakeTimers();
    try {
      const caller = new AbortController();
      const signals: AbortSignal[] = [];
      const remove = vi.spyOn(caller.signal, "removeEventListener");
      const { service } = fixture({
        grant: async (request) => {
          if (request.signal) signals.push(request.signal);
          return { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" };
        },
      });
      expect(await service.listDefinitions(caller.signal)).toHaveLength(1);
      expect(signals).toHaveLength(2);
      expect(remove).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
      caller.abort();
      await vi.advanceTimersByTimeAsync(context.budget.maxTimeMs);
      expect(signals.every((signal) => !signal.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
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
      const rejected = expect(read).rejects.toMatchObject({ code: "metrics-core/read-timeout" });
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

  it.each(["resolve", "reject"] as const)(
    "times out when synchronous authorization work reaches the deadline before %s settlement",
    async (settlement) => {
      let scopedSignal: AbortSignal | undefined;
      vi.useFakeTimers();
      try {
        const { service } = fixture({
          grant: async (request) => {
            scopedSignal = request.signal;
            vi.setSystemTime(Date.now() + context.budget.maxTimeMs);
            if (settlement === "reject") throw new Error("Authority rejected after blocking");
            return { permissionEpoch: "permission-1", privacyEpoch: "privacy-1" };
          },
        });
        await expect(service.listDefinitions()).rejects.toMatchObject({
          code: "metrics-core/read-timeout",
        });
        expect(scopedSignal?.aborted).toBe(true);
        expect(scopedSignal?.reason).toMatchObject({ code: "metrics-core/read-timeout" });
        await vi.runAllTimersAsync();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["definitions", "queries"] as const)(
    "shares one time budget across all %s authorizations",
    async (kind) => {
      vi.useFakeTimers();
      try {
        const { query } = fixture();
        const authorize = vi.fn(
          async () =>
            new Promise<{ permissionEpoch: string; privacyEpoch: string }>((resolve) => {
              setTimeout(
                () => resolve({ permissionEpoch: "permission-1", privacyEpoch: "privacy-1" }),
                40,
              );
            }),
        );
        const service = new MetricReadService(
          [definition, { ...definition, id: "second" }, { ...definition, id: "third" }],
          [query, { ...query, id: "second" }, { ...query, id: "third" }],
          {
            currentContext: () => ({ ...context, budget: { ...context.budget, maxTimeMs: 100 } }),
            authorize,
          },
        );
        const pending =
          kind === "definitions" ? service.listDefinitions() : service.listRegisteredQueries();
        const rejected = expect(pending).rejects.toMatchObject({
          code: "metrics-core/read-timeout",
        });
        await vi.advanceTimersByTimeAsync(80);
        expect(authorize).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(20);
        await rejected;
        await vi.runAllTimersAsync();
        expect(authorize).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["definitions", "queries", "explanation"] as const)(
    "includes %s epoch rechecks in the same time budget",
    async (kind) => {
      vi.useFakeTimers();
      try {
        const authorize = vi.fn(
          async () =>
            new Promise<{ permissionEpoch: string; privacyEpoch: string }>((resolve) => {
              setTimeout(
                () => resolve({ permissionEpoch: "permission-1", privacyEpoch: "privacy-1" }),
                60,
              );
            }),
        );
        const { service } = fixture({
          context: { ...context, budget: { ...context.budget, maxTimeMs: 100 } },
          grant: authorize,
        });
        const pending =
          kind === "definitions"
            ? service.listDefinitions()
            : kind === "queries"
              ? service.listRegisteredQueries()
              : service.explainDefinition(definition.id);
        const rejected = expect(pending).rejects.toMatchObject({
          code: "metrics-core/read-timeout",
        });
        await vi.advanceTimersByTimeAsync(60);
        expect(authorize).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(40);
        await rejected;
        await vi.runAllTimersAsync();
        expect(authorize).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("lists authorized query metadata without executable contracts", async () => {
    const { service, query, executor } = fixture();
    expect(await service.listRegisteredQueries()).toEqual([
      {
        id: query.id,
        version: query.version,
        definitionRefs: query.definitionRefs,
        unit: query.unit,
        population: query.population,
        filter: query.filter,
        requiredFields: query.requiredFields,
        requiresRaw: query.requiresRaw,
        limits: query.limits,
      },
    ]);
    expect(executor).not.toHaveBeenCalled();
  });

  it.each([
    ["field", { requiredFields: ["amountMinor", "customerId"] }],
    ["raw", { requiresRaw: true }],
  ])("hides registered queries without %s permission", async (_label, query) => {
    const { service } = fixture({ query });
    expect(await service.listRegisteredQueries()).toEqual([]);
    expect(await service.listDefinitions()).toHaveLength(1);
  });

  it.each(["permissionEpoch", "privacyEpoch"] as const)(
    "hides registered queries when %s changes before return",
    async (epoch) => {
      let calls = 0;
      const { service } = fixture({
        grant: async () => ({
          permissionEpoch: "permission-1",
          privacyEpoch: "privacy-1",
          [epoch]: ++calls === 1 ? "original" : "changed",
        }),
      });
      expect(await service.listRegisteredQueries()).toEqual([]);
    },
  );

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
  it("rejects a different expected query version before report lookup or execution", async () => {
    const { service, executor, reader } = fixture({ report: report() });
    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
        expectedVersion: 2,
      }),
    ).toEqual({ status: "unavailable" });
    expect(reader.readCandidates).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
  });

  it("executes the registered query when the expected version matches", async () => {
    const { service, executor } = fixture();
    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
        expectedVersion: 1,
      }),
    ).toEqual({ status: "verified", source: "executor", result });
    expect(executor).toHaveBeenCalledOnce();
  });

  it("keeps a cancelled invocation reader in the shared concurrency budget until it settles", async () => {
    const controller = new AbortController();
    let release!: (reports: readonly VerifiedMetricReport[]) => void;
    const pending = new Promise<readonly VerifiedMetricReport[]>((resolve) => {
      release = resolve;
    });
    const reader: VerifiedReportReader = {
      readCandidates: vi.fn(() => pending),
      verify: vi.fn(async () => true),
    };
    const { service, executor } = fixture({ reader });
    const first = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(reader.readCandidates).toHaveBeenCalledOnce());
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    await expect(
      service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).rejects.toMatchObject({ code: "metrics-core/concurrency-budget-exceeded" });
    expect(executor).not.toHaveBeenCalled();
    release([]);
    await pending;
    expect(
      await service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window),
    ).toEqual({ status: "verified", source: "executor", result });
  });

  it("cancels a pending executor using the per-invocation signal", async () => {
    const controller = new AbortController();
    let release!: (read: MetricReadResult) => void;
    const pending = new Promise<MetricReadResult>((resolve) => {
      release = resolve;
    });
    const { service, executor } = fixture({ executor: () => pending });
    const first = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(executor).toHaveBeenCalledOnce());
    controller.abort();
    await expect(first).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    release(result);
    await pending;
  });

  it("preserves authority cancellation when the invocation supplies another signal", async () => {
    const authorityController = new AbortController();
    const invocationController = new AbortController();
    let release!: (read: MetricReadResult) => void;
    const pending = new Promise<MetricReadResult>((resolve) => {
      release = resolve;
    });
    const { service, executor } = fixture({
      context: { ...context, signal: authorityController.signal },
      executor: () => pending,
    });
    const first = service.runRegisteredQuery("captures_by_currency", { currency: "USD" }, window, {
      signal: invocationController.signal,
    });
    await vi.waitFor(() => expect(executor).toHaveBeenCalledOnce());
    authorityController.abort();
    await expect(first).rejects.toMatchObject({ code: "metrics-core/read-cancelled" });
    expect(invocationController.signal.aborted).toBe(false);
    release(result);
    await pending;
  });
});
