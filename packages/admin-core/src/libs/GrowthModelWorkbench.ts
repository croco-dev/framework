import {
  validateStatePartition,
  validateGrowthDataset,
  validateGrowthScope,
  estimateTransitionMatrix,
  projectGrowthModel,
  backtestGrowthModel,
} from "@croco/metrics-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  GrowthScope,
  GrowthModel,
  GrowthLimits,
  GrowthScenario,
  GrowthDataset,
  GrowthEstimate,
  GrowthProjection,
  GrowthBacktest,
} from "@croco/metrics-core";

export type GrowthWorkbenchRequest = {
  scope: GrowthScope;
  model: GrowthModel;
  sourceRevision: string;
  scenario: GrowthScenario;
  backtest: Parameters<typeof backtestGrowthModel>[2];
};
export type GrowthWorkbenchReport = {
  schema: "croco.growth-report/v1";
  scope: GrowthScope;
  model: GrowthModel;
  scenario: GrowthScenario;
  sourceRevision: string;
  cutoff: number;
  modelHash: string;
  inputHash: string;
  analysisHash: string;
  estimate: GrowthEstimate;
  projection: GrowthProjection;
  backtest: GrowthBacktest;
  backtestAssumptions: GrowthScenario["inflows"];
  partitionValidation: GrowthDataset["partitionValidation"];
  diagnostics: GrowthDataset["diagnostics"];
  observedPopulations: GrowthDataset["populations"];
};
export type GrowthWorkbenchState =
  | { kind: "loading" }
  | { kind: "denied" | "error" | "empty" | "partial"; code: string }
  | { kind: "ready"; report: GrowthWorkbenchReport };
export type GrowthReportRecord = {
  id: string;
  revision: number;
  actor: string;
  previousAnalysisHash: string | null;
  report: GrowthWorkbenchReport;
};
export interface GrowthReportStore {
  read(scope: GrowthScope, id: string): Promise<GrowthReportRecord | undefined>;
  /** Atomically compare expectedRevision and append an audit record. Reject model ID/version/hash collisions across history; never overwrite audit history. */
  append(scope: GrowthScope, record: GrowthReportRecord, expectedRevision: number): Promise<void>;
}
export interface GrowthWorkbenchAdapter {
  /** Host owns authenticated actor, tenant isolation, masking/deletion and source freshness. No browser-supplied actor. */
  authorize(
    scope: GrowthScope,
    permission: "growth:read" | "growth:report:read" | "growth:report:write",
  ): Promise<boolean>;
  actor(): Promise<string>;
  /** Must reject exceeded bounds, not truncate; immutable sourceRevision pins the source snapshot. Return aggregates only. */
  read(input: {
    scope: GrowthScope;
    model: GrowthModel;
    sourceRevision: string;
    maxRows: number;
    signal?: AbortSignal;
  }): Promise<GrowthDataset>;
}
const GROWTH_PROBLEMS = {
  denied: { code: "admin-core/growth-denied", category: ProblemCategory.Forbidden },
  "invalid-request": {
    code: "admin-core/growth-invalid-request",
    category: ProblemCategory.ValidationError,
  },
  "scope-mismatch": {
    code: "admin-core/growth-scope-mismatch",
    category: ProblemCategory.ValidationError,
  },
  "stale-input": {
    code: "admin-core/growth-stale-input",
    category: ProblemCategory.ValidationError,
  },
  "revision-conflict": {
    code: "admin-core/growth-revision-conflict",
    category: ProblemCategory.ValidationError,
  },
  "source-failed": {
    code: "admin-core/growth-source-failed",
    category: ProblemCategory.InternalServerError,
  },
} as const;
export class GrowthWorkbenchProblem extends Problem {
  constructor(readonly reason: keyof typeof GROWTH_PROBLEMS) {
    super(
      GROWTH_PROBLEMS[reason].code,
      GROWTH_PROBLEMS[reason].category,
      `Growth workbench: ${reason}`,
    );
  }
}
function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new GrowthWorkbenchProblem("invalid-request");
}
function scopeCopy(scope: GrowthScope): GrowthScope {
  return { appId: scope.appId, environment: scope.environment, tenantId: scope.tenantId };
}
function sameScope(a: GrowthScope, b: GrowthScope): boolean {
  return a.appId === b.appId && a.environment === b.environment && a.tenantId === b.tenantId;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => JSON.stringify(key) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
async function hash(value: unknown): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Whitelist human-authored definition fields. Sources must not put PII in labels or evidence. */
function modelCopy(model: GrowthModel): GrowthModel {
  return {
    id: model.id,
    version: model.version,
    unit: model.unit,
    period: model.period,
    purpose: model.purpose,
    definitionCutoff: model.definitionCutoff,
    stateDefinitions: model.stateDefinitions.map((s) => ({
      id: s.id,
      label: s.label,
      evidence: s.evidence,
    })),
    assumptions: [...model.assumptions],
    transitionEstimationWindow: {
      from: model.transitionEstimationWindow.from,
      to: model.transitionEstimationWindow.to,
    },
  };
}
function scenarioCopy(scenario: GrowthScenario): GrowthScenario {
  return {
    horizon: scenario.horizon,
    initialPopulation: [...scenario.initialPopulation],
    inflows: {
      unit: scenario.inflows.unit,
      label: scenario.inflows.label,
      rationale: scenario.inflows.rationale,
      values: scenario.inflows.values.map((v) => [...v]),
    },
    matrixOverrides: scenario.matrixOverrides.map((o) => ({
      stateId: o.stateId,
      row: [...o.row],
      method: o.method,
      rationale: o.rationale,
    })),
  };
}
/** The UI submits definitions and scenarios; this server boundary validates, reads and calculates them. */
export function createGrowthModelWorkbenchSource(input: {
  adapter: GrowthWorkbenchAdapter;
  limits: GrowthLimits;
  reports?: GrowthReportStore;
}) {
  const bounds = { ...input.limits };
  async function grant(
    scope: GrowthScope,
    permissions: readonly ("growth:read" | "growth:report:read" | "growth:report:write")[],
  ) {
    validateGrowthScope(scope);
    for (const permission of permissions)
      if (!(await input.adapter.authorize({ ...scope }, permission)))
        throw new GrowthWorkbenchProblem("denied");
  }
  async function calculate(
    request: GrowthWorkbenchRequest,
    signal?: AbortSignal,
  ): Promise<GrowthWorkbenchReport> {
    request = structuredClone(request);
    requireValue(
      request != null &&
        typeof request.sourceRevision === "string" &&
        request.sourceRevision.trim().length > 0,
    );
    validateStatePartition(request.model, bounds);
    await grant(request.scope, ["growth:read"]);
    const model = modelCopy(request.model);
    const data = structuredClone(
      await input.adapter.read({
        scope: { ...request.scope },
        model: structuredClone(model),
        sourceRevision: request.sourceRevision,
        maxRows: bounds.maxRows,
        ...(signal ? { signal } : {}),
      }),
    );
    validateGrowthDataset(model, data, bounds);
    if (!sameScope(data.scope, request.scope)) throw new GrowthWorkbenchProblem("scope-mismatch");
    if (data.sourceRevision !== request.sourceRevision)
      throw new GrowthWorkbenchProblem("stale-input");
    if (signal?.aborted) throw new GrowthWorkbenchProblem("source-failed");
    const estimate = estimateTransitionMatrix(model, data, bounds);
    const projection = projectGrowthModel(model, estimate.matrix, request.scenario, bounds);
    const backtest = backtestGrowthModel(model, data, request.backtest, bounds);
    const scenario = scenarioCopy(request.scenario);
    const modelHash = await hash(model);
    const inputHash = await hash({
      ...data,
      populations: [...data.populations].sort((a, b) => a.period - b.period),
      transitions: [...data.transitions].sort((a, b) => a.from - b.from),
    });
    const content = {
      schema: "croco.growth-report/v1" as const,
      scope: scopeCopy(request.scope),
      model,
      scenario,
      sourceRevision: data.sourceRevision,
      cutoff: request.backtest.trainEnd,
      modelHash,
      inputHash,
      estimate,
      projection,
      backtest,
      backtestAssumptions: {
        unit: request.backtest.inflows.unit,
        label: request.backtest.inflows.label,
        rationale: request.backtest.inflows.rationale,
        values: request.backtest.inflows.values.map((v) => [...v]),
      },
      partitionValidation: data.partitionValidation,
      diagnostics: data.diagnostics.map((d) => ({
        period: d.period,
        reason: d.reason,
        count: d.count,
      })),
      observedPopulations: data.populations
        .map((p) => ({ period: p.period, values: [...p.values], complete: p.complete }))
        .sort((a, b) => a.period - b.period),
    };
    const analysisHash = await hash(content);
    await grant(request.scope, ["growth:read"]);
    return { ...content, analysisHash };
  }
  const api = {
    calculate,
    async load(
      request: GrowthWorkbenchRequest,
      signal?: AbortSignal,
    ): Promise<GrowthWorkbenchState> {
      try {
        return { kind: "ready", report: await calculate(request, signal) };
      } catch (error) {
        if (error instanceof GrowthWorkbenchProblem && error.reason === "denied")
          return { kind: "denied", code: error.code };
        if (error instanceof Problem) {
          if ("field" in error && error.field === "unobserved-row")
            return { kind: "empty", code: error.code };
          if ("field" in error && error.field === "backtest-initial")
            return { kind: "partial", code: error.code };
          return { kind: "error", code: error.code };
        }
        return { kind: "error", code: "admin-core/growth-source-failed" };
      }
    },
    async save(
      request: GrowthWorkbenchRequest,
      id: string,
      expectedRevision: number,
      expectedAnalysisHash: string,
    ): Promise<GrowthReportRecord> {
      request = structuredClone(request);
      requireValue(
        input.reports !== undefined &&
          request != null &&
          typeof id === "string" &&
          id.trim().length > 0 &&
          id.length <= 200 &&
          Number.isSafeInteger(expectedRevision) &&
          expectedRevision < Number.MAX_SAFE_INTEGER &&
          expectedRevision >= 0,
      );
      await grant(request.scope, ["growth:read", "growth:report:read", "growth:report:write"]);
      const report = await calculate(request);
      if (report.analysisHash !== expectedAnalysisHash)
        throw new GrowthWorkbenchProblem("stale-input");
      const prior = await api.readSaved(request.scope, id);
      if ((prior?.revision ?? 0) !== expectedRevision)
        throw new GrowthWorkbenchProblem("revision-conflict");
      if (
        prior &&
        prior.report.model.id === report.model.id &&
        prior.report.model.version === report.model.version &&
        prior.report.modelHash !== report.modelHash
      )
        throw new GrowthWorkbenchProblem("revision-conflict");
      const actor = await input.adapter.actor();
      requireValue(typeof actor === "string" && actor.trim().length > 0 && actor.length <= 200);
      const record = {
        id,
        revision: expectedRevision + 1,
        actor,
        previousAnalysisHash: prior?.report.analysisHash ?? null,
        report,
      };
      await grant(request.scope, ["growth:read", "growth:report:read", "growth:report:write"]);
      await input.reports.append({ ...request.scope }, structuredClone(record), expectedRevision);
      await grant(request.scope, ["growth:report:read"]);
      return record;
    },
    async readSaved(scope: GrowthScope, id: string): Promise<GrowthReportRecord | undefined> {
      scope = { ...scope };
      requireValue(
        input.reports !== undefined &&
          typeof id === "string" &&
          id.trim().length > 0 &&
          id.length <= 200,
      );
      await grant(scope, ["growth:report:read"]);
      const record = structuredClone(await input.reports.read(scope, id));
      if (record) {
        requireValue(
          record.id === id &&
            Number.isSafeInteger(record.revision) &&
            record.revision > 0 &&
            typeof record.actor === "string" &&
            record.actor.trim().length > 0 &&
            record.report?.schema === "croco.growth-report/v1",
        );
        if (!sameScope(record.report.scope, scope))
          throw new GrowthWorkbenchProblem("scope-mismatch");
        validateStatePartition(record.report.model, bounds);
        const { analysisHash, ...content } = record.report;
        if (
          record.report.modelHash !== (await hash(record.report.model)) ||
          analysisHash !== (await hash(content))
        )
          throw new GrowthWorkbenchProblem("stale-input");
        // Stored historical results are evidence at cutoff, not fresh forecasts. Do not silently recompute them.
      }
      await grant(scope, ["growth:report:read"]);
      return record;
    },
  };
  return api;
}
