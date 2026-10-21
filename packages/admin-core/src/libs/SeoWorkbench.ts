import {
  hashSeoInput,
  seoScopeKey,
  SeoComparisonProblem,
  validateSeoDefinition,
} from "@croco/metrics-core";
import { parseSeoReport } from "@croco/metrics-core/runtime";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  SeoScope,
  SeoDefinition,
  SeoComparisonReport,
  SeoComparisonRow,
  SeoWindow,
} from "@croco/metrics-core";
import type { MetricReadService } from "@croco/metrics-core/runtime";

export type SeoPermission = "seo.read" | "seo.report" | "seo.export" | "seo.delete";
export type SeoAccess = { scope: SeoScope; permissions: readonly SeoPermission[] };
export type SeoSavedReport = {
  id: string;
  scope: SeoScope;
  expiresAt: string;
  report: SeoComparisonReport;
};
export type SeoWorkbenchPage = {
  report: Omit<SeoComparisonReport, "rows">;
  rows: SeoComparisonRow[];
  offset: number;
  nextOffset: number | null;
  total: number;
};
export type SeoWorkbenchState =
  | { kind: "loading" }
  | { kind: "denied" | "error" | "unavailable"; code: string }
  | { kind: "ready" | "partial" | "empty"; page: SeoWorkbenchPage };
export type SeoWorkbenchOptions = {
  authenticate(): Promise<SeoAccess>;
  /** Bind definitions, source revisions and raw loader to registerSeoQuery + the shared MetricReadService. */
  reader(
    scope: SeoScope,
    definition: SeoDefinition,
    signal?: AbortSignal,
  ): Promise<{ service: MetricReadService; queryId: string; window: SeoWindow }>;
  /** Application field policy. Never send raw page URLs, queries or source references to the browser. */
  mask(field: "pageId" | "sourceRef" | "change", value: string, scope: SeoScope): string;
  store: {
    write(scope: SeoScope, record: SeoSavedReport, signal?: AbortSignal): Promise<void>;
    read(scope: SeoScope, id: string, signal?: AbortSignal): Promise<SeoSavedReport | undefined>;
    delete(scope: SeoScope, id: string, signal?: AbortSignal): Promise<void>;
  };
  now(): Date;
};
export class SeoWorkbenchProblem extends Problem {
  constructor(readonly reason: string) {
    super(
      `admin-core/seo-${reason}`,
      reason === "denied" ? ProblemCategory.Forbidden : ProblemCategory.ValidationError,
      `SEO workbench: ${reason}`,
    );
  }
}
function check(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new SeoWorkbenchProblem(reason);
}
/** Scope is resolved on the server for every operation, including exports and retained report reads. */
export function createSeoWorkbench(options: SeoWorkbenchOptions) {
  async function access(
    permission: SeoPermission,
    expected?: SeoScope,
    signal?: AbortSignal,
  ): Promise<SeoScope> {
    signal?.throwIfAborted();
    const grant = await options.authenticate();
    signal?.throwIfAborted();
    check(
      grant && grant.permissions.includes("seo.read") && grant.permissions.includes(permission),
      "denied",
    );
    const key = seoScopeKey(grant.scope);
    check(!expected || key === seoScopeKey(expected), "denied");
    return structuredClone(grant.scope);
  }
  function masked(report: SeoComparisonReport, scope: SeoScope): SeoComparisonReport {
    report = structuredClone(report);
    report.rows = report.rows.map((row) => ({
      ...row,
      pageId: options.mask("pageId", row.pageId, scope),
      baseline: row.baseline
        ? {
            ...row.baseline,
            mappingRefs: row.baseline.mappingRefs.map((r) => options.mask("sourceRef", r, scope)),
          }
        : null,
      current: row.current
        ? {
            ...row.current,
            mappingRefs: row.current.mappingRefs.map((r) => options.mask("sourceRef", r, scope)),
          }
        : null,
    }));
    report.sources = report.sources.map((source) => ({
      ...source,
      source: options.mask("sourceRef", source.source, scope),
      sourceRevision: options.mask("sourceRef", source.sourceRevision, scope),
    }));
    report.changes = report.changes.map((c) => ({
      ...c,
      label: options.mask("change", c.label, scope),
      sourceRef: options.mask("sourceRef", c.sourceRef, scope),
    }));
    return report;
  }
  function validatePage(offset: number, limit: number): void {
    check(
      Number.isSafeInteger(offset) &&
        offset >= 0 &&
        Number.isSafeInteger(limit) &&
        limit >= 1 &&
        limit <= 100,
      "pagination",
    );
  }
  function page(report: SeoComparisonReport, offset: number, limit: number): SeoWorkbenchPage {
    validatePage(offset, limit);
    const { rows, ...summary } = report;
    return {
      report: summary,
      rows: rows.slice(offset, offset + limit),
      offset,
      total: rows.length,
      nextOffset: offset + limit < rows.length ? offset + limit : null,
    };
  }
  async function calculate(
    scope: SeoScope,
    definition: SeoDefinition,
    signal?: AbortSignal,
  ): Promise<SeoComparisonReport | SeoWorkbenchState> {
    validateSeoDefinition(definition);
    const { service, queryId, window } = await options.reader(
      scope,
      structuredClone(definition),
      signal,
    );
    await access("seo.read", scope, signal);
    const result = await service.runRegisteredQuery(queryId, null, window, { signal });
    await access("seo.read", scope, signal);
    if (result.status === "denied") return { kind: "denied", code: "SEO_DENIED" };
    if (!("result" in result) || !result.result)
      return {
        kind: "unavailable",
        code: result.status === "stale" ? "SEO_STALE" : "SEO_UNAVAILABLE",
      };
    const report = parseSeoReport(result.result.data);
    check(
      seoScopeKey(report.scope) === seoScopeKey(scope) &&
        (await hashSeoInput(report.definition)) === (await hashSeoInput(definition)),
      "report-identity",
    );
    if (result.status === "partial") report.state = "partial";
    return report;
  }
  const api = {
    async read(
      definition: SeoDefinition,
      offset = 0,
      limit = 25,
      signal?: AbortSignal,
    ): Promise<SeoWorkbenchState> {
      try {
        const scope = await access("seo.read", undefined, signal);
        try {
          validateSeoDefinition(definition);
          validatePage(offset, limit);
        } catch (error) {
          if (error instanceof SeoComparisonProblem || error instanceof SeoWorkbenchProblem)
            return { kind: "error", code: "SEO_INVALID_REQUEST" };
          throw error;
        }
        const report = await calculate(scope, definition, signal);
        if ("kind" in report) return report;
        const result = page(masked(report, scope), offset, limit);
        await access("seo.read", scope, signal);
        return { kind: report.state, page: result };
      } catch (error) {
        signal?.throwIfAborted();
        if (error instanceof SeoWorkbenchProblem && error.reason === "denied")
          return { kind: "denied", code: "SEO_DENIED" };
        return {
          kind: "error",
          code: "SEO_SOURCE_ERROR",
        };
      }
    },
    async save(
      id: string,
      definition: SeoDefinition,
      expectedInputHash: string,
      expiresAt: string,
      signal?: AbortSignal,
    ): Promise<void> {
      check(typeof id === "string" && id.trim().length > 0 && id.length <= 128, "report-id");
      check(
        Number.isFinite(Date.parse(expiresAt)) &&
          Date.parse(expiresAt) > options.now().getTime() &&
          Date.parse(expiresAt) <= options.now().getTime() + 30 * 86400000,
        "retention",
      );
      const scope = await access("seo.report", undefined, signal);
      const report = await calculate(scope, definition, signal);
      check(!("kind" in report), "source-unavailable");
      check(report.inputHash === expectedInputHash, "stale-input");
      await access("seo.report", scope, signal);
      // Persist only masked aggregate evidence; the host owns durable, scope-isolated storage.
      await options.store.write(
        scope,
        { id, scope, expiresAt, report: masked(report, scope) },
        signal,
      );
      await access("seo.report", scope, signal);
    },
    async readSaved(
      id: string,
      offset = 0,
      limit = 25,
      signal?: AbortSignal,
    ): Promise<SeoWorkbenchState> {
      const scope = await access("seo.read", undefined, signal);
      const record = structuredClone(await options.store.read(scope, id, signal));
      await access("seo.read", scope, signal);
      if (!record) return { kind: "unavailable", code: "SEO_REPORT_MISSING" };
      check(
        record.id === id &&
          seoScopeKey(record.scope) === seoScopeKey(scope) &&
          seoScopeKey(record.report.scope) === seoScopeKey(scope),
        "report-identity",
      );
      if (!(Date.parse(record.expiresAt) > options.now().getTime()))
        return { kind: "unavailable", code: "SEO_REPORT_EXPIRED" };
      // Re-read the immutable source with current authority, privacy and masking policies.
      const current = await calculate(scope, record.report.definition, signal);
      if ("kind" in current) return current;
      if (current.inputHash !== record.report.inputHash)
        return { kind: "unavailable", code: "SEO_REPORT_STALE" };
      const result = page(masked(current, scope), offset, limit);
      await access("seo.read", scope, signal);
      if (!(Date.parse(record.expiresAt) > options.now().getTime()))
        return { kind: "unavailable", code: "SEO_REPORT_EXPIRED" };
      return { kind: current.state, page: result };
    },
    async export(
      definition: SeoDefinition,
      expectedInputHash: string,
      signal?: AbortSignal,
    ): Promise<string> {
      const scope = await access("seo.export", undefined, signal);
      const report = await calculate(scope, definition, signal);
      check(!("kind" in report), "source-unavailable");
      check(report.inputHash === expectedInputHash, "stale-input");
      await access("seo.export", scope, signal);
      return JSON.stringify(masked(report, scope));
    },
    async delete(id: string, signal?: AbortSignal): Promise<void> {
      const scope = await access("seo.delete", undefined, signal);
      await options.store.delete(scope, id, signal);
      await access("seo.delete", scope, signal);
    },
  };
  return api;
}
