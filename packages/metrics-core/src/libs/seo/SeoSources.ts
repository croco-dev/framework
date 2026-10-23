import { decodeSource } from "@croco/etl-core/source";
import { cancellableSource, readBoundedWarehouse } from "../read/BoundedSource";
import {
  compareSeo,
  validateSeoDefinition,
  hashSeoInput,
  requireSeo,
  seoScopeKey,
  SeoComparisonProblem,
} from "./SeoComparison";
import type { SourceSchema } from "@croco/etl-core/source";
import type { WarehouseReader, WarehouseReadRequest } from "@croco/warehouse-core/runtime";
import type {
  SeoSearchRow,
  SeoLandingRow,
  SeoComparisonInput,
  SeoComparisonReport,
  SeoDefinition,
  SeoScope,
} from "./SeoComparison";
import type {
  MetricReadContext,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  MetricReadQuality,
  SourceRevision,
} from "../read/MetricReadService";

/** Only column semantics live here. ETL owns bytes, CSV/JSONL parsing and row-position errors. */
type SeoField = keyof SeoSearchRow | keyof SeoLandingRow;
export type SeoColumnBinding = Readonly<Partial<Record<SeoField, string>>>;
export function normalizeSeoRow(
  row: Readonly<Record<string, unknown>>,
  kind: "search",
  binding: SeoColumnBinding,
): SeoSearchRow;
export function normalizeSeoRow(
  row: Readonly<Record<string, unknown>>,
  kind: "landing",
  binding: SeoColumnBinding,
): SeoLandingRow;
export function normalizeSeoRow(
  row: Readonly<Record<string, unknown>>,
  kind: "search" | "landing",
  binding: SeoColumnBinding,
): SeoSearchRow | SeoLandingRow {
  const value = (field: SeoField) => row[binding[field] ?? field];
  const text = (field: "page" | "device") => {
    const v = value(field);
    requireSeo(typeof v === "string" && v.trim(), `source.${field}`);
    return v;
  };
  const number = (field: Exclude<SeoField, "page" | "device" | "query">) => {
    const raw = value(field);
    const fractional = ["position", "lcpP75"].includes(field);
    const lexeme = fractional ? /^(0|[1-9]\d*)(\.\d+)?$/ : /^(0|[1-9]\d*)$/;
    const v = typeof raw === "string" && lexeme.test(raw) ? Number(raw) : raw;
    requireSeo(
      v === null ||
        (typeof v === "number" &&
          Number.isFinite(v) &&
          v >= 0 &&
          (fractional || Number.isSafeInteger(v))),
      `source.${field}`,
    );
    return v;
  };
  const base = { page: text("page"), device: text("device") };
  if (kind === "landing")
    return {
      ...base,
      sessions: number("sessions"),
      outcomes: number("outcomes"),
      lcpP75: number("lcpP75"),
    };
  const query = value("query");
  requireSeo(
    query === undefined || query === null || (typeof query === "string" && query.trim()),
    "source.query",
  );
  return {
    ...base,
    impressions: number("impressions"),
    clicks: number("clicks"),
    position: number("position"),
    ...(query === undefined ? {} : { query }),
  };
}
export async function collectSeoSource(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  kind: "search",
  binding: SeoColumnBinding,
  maxRows: number,
  signal?: AbortSignal,
): Promise<SeoSearchRow[]>;
export async function collectSeoSource(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  kind: "landing",
  binding: SeoColumnBinding,
  maxRows: number,
  signal?: AbortSignal,
): Promise<SeoLandingRow[]>;
export async function collectSeoSource(
  source: AsyncIterable<Readonly<Record<string, unknown>>>,
  kind: "search" | "landing",
  binding: SeoColumnBinding,
  maxRows: number,
  signal?: AbortSignal,
): Promise<(SeoSearchRow | SeoLandingRow)[]> {
  requireSeo(Number.isSafeInteger(maxRows) && maxRows > 0 && maxRows <= 10000, "source.maxRows");
  binding = { ...binding };
  const rows: (SeoSearchRow | SeoLandingRow)[] = [];
  for await (const row of cancellableSource(source, signal)) {
    requireSeo(rows.length < maxRows, "source.row-budget");
    rows.push(
      kind === "search"
        ? normalizeSeoRow(row, "search", binding)
        : normalizeSeoRow(row, "landing", binding),
    );
  }
  return rows;
}
export function importSeoSearch(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
  binding: SeoColumnBinding,
  maxRows: number,
  signal?: AbortSignal,
): Promise<SeoSearchRow[]> {
  return collectSeoSource(
    decodeSource(cancellableSource(bytes, signal), schema),
    "search",
    binding,
    maxRows,
    signal,
  );
}
export function importSeoLanding(
  bytes: AsyncIterable<Uint8Array>,
  schema: SourceSchema,
  binding: SeoColumnBinding,
  maxRows: number,
  signal?: AbortSignal,
): Promise<SeoLandingRow[]> {
  return collectSeoSource(
    decodeSource(cancellableSource(bytes, signal), schema),
    "landing",
    binding,
    maxRows,
    signal,
  );
}
export function readSeoWarehouse(
  reader: WarehouseReader,
  request: Omit<WarehouseReadRequest, "cursor">,
  limits: { maxRows: number; maxBytes: number; maxPages: number },
): AsyncIterable<Readonly<Record<string, unknown>>> {
  return readBoundedWarehouse(reader, request, limits, (detail) => {
    throw new SeoComparisonProblem(`source.${detail}`);
  });
}

/** The existing MetricReadService owns permission epochs, field grants, budgets, cancellation and report verification. */
export async function registerSeoQuery(options: {
  queryId: string;
  queryVersion: number;
  definition: SeoDefinition;
  scope: SeoScope;
  sourceRevisions: readonly SourceRevision[];
  limits: RegisteredMetricQuery["limits"];
  requiredFields: readonly string[];
  source(
    context: MetricReadContext,
    signal: AbortSignal,
  ): Promise<{ input: SeoComparisonInput; quality: MetricReadQuality }>;
}): Promise<{ definition: RegisteredMetricDefinition; query: RegisteredMetricQuery }> {
  const { source, ...config } = options;
  const declaration = structuredClone(config);
  seoScopeKey(declaration.scope);
  validateSeoDefinition(declaration.definition);
  requireSeo(
    declaration.queryId.trim() &&
      Number.isSafeInteger(declaration.queryVersion) &&
      declaration.queryVersion > 0 &&
      declaration.sourceRevisions.length > 0 &&
      declaration.requiredFields.length > 0,
    "query.registration",
  );
  const hash = await hashSeoInput(declaration);
  const definition: RegisteredMetricDefinition = {
    id: declaration.definition.id,
    version: declaration.queryVersion,
    hash,
    unit: "page-comparisons",
    population: "mapped-search-page-device",
    sourceRefs: [...new Set(declaration.sourceRevisions.map((r) => r.sourceRef))],
    description: "Search and landing comparison; observational candidates only",
    requiredFields: declaration.requiredFields,
    requiresRaw: false,
  };
  const parseInput = (input: unknown) => {
    requireSeo(input === null, "query.input");
    return null;
  };
  const query: RegisteredMetricQuery = {
    id: declaration.queryId,
    version: declaration.queryVersion,
    definitionRefs: [definition.id],
    unit: definition.unit,
    population: definition.population,
    filter: declaration.definition.candidate,
    requiredFields: declaration.requiredFields,
    requiresRaw: false,
    partialDataPolicy: "authorized",
    limits: declaration.limits,
    inputSchema: { parse: parseInput },
    inputKey: (input) => {
      parseInput(input);
      return hash;
    },
    outputSchema: { parse: parseSeoReport },
    async readExecutor({ context, signal, window }) {
      requireSeo(seoScopeKey(context.principal) === seoScopeKey(declaration.scope), "query.scope");
      requireSeo(
        declaration.sourceRevisions.every((ref) =>
          context.sourceRevisions.some(
            (r) => r.sourceRef === ref.sourceRef && r.revision === ref.revision,
          ),
        ),
        "query.revisions",
      );
      const { input, quality } = structuredClone(await source(context, signal));
      signal.throwIfAborted();
      requireSeo(seoScopeKey(input.scope) === seoScopeKey(declaration.scope), "query.input-scope");
      input.definition = declaration.definition;
      const datasets = [
        input.baseline.search,
        input.current.search,
        ...(input.baseline.landing ? [input.baseline.landing] : []),
        ...(input.current.landing ? [input.current.landing] : []),
      ];
      const rowCount = datasets.reduce((sum, d) => sum + d.rows.length, 0);
      requireSeo(
        rowCount <= declaration.limits.maxRows &&
          new TextEncoder().encode(JSON.stringify(input)).length <= declaration.limits.maxBytes,
        "query.input-budget",
      );
      requireSeo(
        datasets.every(
          (d) =>
            Date.parse(d.metadata.window.from) >= Date.parse(window.from) &&
            Date.parse(d.metadata.window.to) <= Date.parse(window.to) &&
            declaration.sourceRevisions.some(
              (r) => r.sourceRef === d.metadata.source && r.revision === d.metadata.sourceRevision,
            ),
        ),
        "query.source-or-window",
      );
      const data = await compareSeo(input);
      signal.throwIfAborted();
      // Source quality axes remain independent; report.state also describes comparison/derived-field availability.
      const incompleteWindow = data.sources.some(
        (source) => source.completeness === "partial" || source.state !== "ready",
      );
      const incompletePopulation =
        data.unmappedRows > 0 ||
        data.sources.some(
          (source) => source.coverage === "returned-rows" || source.state !== "ready",
        );
      return {
        data,
        principal: context.principal,
        definition,
        unit: definition.unit,
        population: definition.population,
        filter: declaration.definition.candidate,
        fieldRefs: declaration.requiredFields,
        window,
        sourceRevisions: context.sourceRevisions,
        snapshotRefs: context.snapshotRefs,
        quality: {
          ...quality,
          temporalCompleteness: incompleteWindow ? "partial" : quality.temporalCompleteness,
          populationCoverage: incompletePopulation ? "partial" : quality.populationCoverage,
        },
        diagnostics: data.diagnostics.map((code) => code.toLowerCase().replaceAll("_", "-")),
        rows: rowCount,
        bytes: new TextEncoder().encode(JSON.stringify(data)).length,
        cost: rowCount,
      };
    },
  };
  return { definition, query };
}
export function parseSeoReport(value: unknown): SeoComparisonReport {
  const object = (v: unknown, keys: readonly string[], field: string) => {
    requireSeo(v && typeof v === "object" && !Array.isArray(v), field);
    requireSeo(
      Object.keys(v).every((k) => keys.includes(k)),
      field,
    );
  };
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((e) => typeof e === "string");
  const nonnegative = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  object(
    value,
    [
      "definition",
      "inputHash",
      "scope",
      "state",
      "rows",
      "population",
      "included",
      "excluded",
      "sources",
      "unmappedRows",
      "missingQueryRows",
      "anonymousQueryRows",
      "diagnostics",
      "assumptions",
      "changes",
    ],
    "report",
  );
  const report = value as SeoComparisonReport;
  requireSeo(
    ["ready", "partial", "empty"].includes(report.state) &&
      /^[a-f0-9]{64}$/.test(report.inputHash) &&
      Array.isArray(report.rows) &&
      report.rows.length <= 20000 &&
      Array.isArray(report.sources) &&
      strings(report.diagnostics) &&
      strings(report.assumptions) &&
      Array.isArray(report.changes),
    "report.shape",
  );
  object(report.scope, ["app", "environment", "tenant"], "report.scope");
  seoScopeKey(report.scope);
  validateSeoDefinition(report.definition);
  requireSeo(
    Number.isSafeInteger(report.population) &&
      report.population >= report.rows.length &&
      report.population <= 20000 &&
      report.included === report.rows.length &&
      report.excluded === report.population - report.included &&
      [report.unmappedRows, report.missingQueryRows, report.anonymousQueryRows].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ),
    "report.counts",
  );
  for (const source of report.sources) {
    object(
      source,
      [
        "scope",
        "rowCount",
        "source",
        "sourceRevision",
        "definitionVersion",
        "timezone",
        "window",
        "grain",
        "unit",
        "denominator",
        "completeness",
        "coverage",
        "state",
      ],
      "report.source",
    );
    object(source.scope, ["app", "environment", "tenant"], "report.source.scope");
    requireSeo(
      Number.isSafeInteger(source.rowCount) &&
        source.rowCount >= 0 &&
        seoScopeKey(source.scope) === seoScopeKey(report.scope) &&
        strings([
          source.source,
          source.sourceRevision,
          source.definitionVersion,
          source.timezone,
          source.denominator,
        ]),
      "report.source",
    );
    object(source.window, ["from", "to"], "report.source.window");
    requireSeo(
      Number.isFinite(Date.parse(source.window.from)) &&
        Date.parse(source.window.from) < Date.parse(source.window.to) &&
        ["page-device", "page-device-query"].includes(source.grain) &&
        ["search-counts", "landing-counts"].includes(source.unit) &&
        ["complete", "partial"].includes(source.completeness) &&
        ["all-pages", "returned-rows"].includes(source.coverage) &&
        ["ready", "error", "unavailable"].includes(source.state),
      "report.source",
    );
  }
  for (const change of report.changes) {
    object(change, ["at", "label", "sourceRef"], "report.change");
    requireSeo(
      strings([change.at, change.label, change.sourceRef]) &&
        Number.isFinite(Date.parse(change.at)),
      "report.change",
    );
  }
  for (const row of report.rows) {
    object(
      row,
      ["pageId", "template", "locale", "device", "baseline", "current", "candidates", "reasons"],
      "report.row",
    );
    requireSeo(
      strings([row.pageId, row.template, row.locale, row.device]) &&
        strings(row.candidates) &&
        strings(row.reasons),
      "report.row",
    );
    for (const period of [row.baseline, row.current]) {
      if (period === null) continue;
      object(
        period,
        [
          "impressions",
          "clicks",
          "ctr",
          "position",
          "sessions",
          "outcomes",
          "valueRate",
          "lcpP75",
          "reasons",
          "mappingRefs",
        ],
        "report.period",
      );
      requireSeo(
        [
          "impressions",
          "clicks",
          "ctr",
          "position",
          "sessions",
          "outcomes",
          "valueRate",
          "lcpP75",
        ].every((k) => {
          const v = period[k as keyof typeof period];
          return v === null || nonnegative(v);
        }) &&
          strings(period.reasons) &&
          strings(period.mappingRefs),
        "report.period",
      );
      requireSeo(
        period.ctr ===
          (period.clicks !== null && period.impressions !== null && period.impressions > 0
            ? period.clicks / period.impressions
            : null) &&
          period.valueRate ===
            (period.outcomes !== null && period.sessions !== null && period.sessions > 0
              ? period.outcomes / period.sessions
              : null),
        "report.ratio",
      );
    }
  }
  return structuredClone(report);
}
