import { Problem, ProblemCategory } from "@croco/problems-core";

export type SeoScope = { app: string; environment: string; tenant: string };
export type SeoWindow = { from: string; to: string };
export type SeoMetadata = {
  scope: SeoScope;
  source: string;
  sourceRevision: string;
  definitionVersion: string;
  timezone: string;
  window: SeoWindow;
  grain: "page-device" | "page-device-query";
  unit: "search-counts" | "landing-counts";
  denominator: string;
  completeness: "complete" | "partial";
  coverage: "all-pages" | "returned-rows";
  state: "ready" | "error" | "unavailable";
};
export type SeoSearchRow = {
  page: string;
  device: string;
  query?: string | null;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
};
export type SeoLandingRow = {
  page: string;
  device: string;
  sessions: number | null;
  outcomes: number | null;
  /** Source percentile at this exact grain only. Never averaged across rows. */
  lcpP75: number | null;
};
export type SeoSearchDataset = { metadata: SeoMetadata; rows: readonly SeoSearchRow[] };
export type SeoLandingDataset = { metadata: SeoMetadata; rows: readonly SeoLandingRow[] };
export type SeoPageMapping = {
  page: string;
  pageId: string;
  template: string;
  locale: string;
  effective: SeoWindow;
  sourceRef: string;
};
export type SeoDefinition = {
  baselineWindow: SeoWindow;
  currentWindow: SeoWindow;
  id: string;
  version: string;
  minImpressions: number;
  minSessions: number;
  minImpressionGrowth: number;
  minClickDecline: number;
  minValueRateDecline: number;
  candidate: "all" | "impressions-up-clicks-down" | "value-rate-down";
};
export type SeoComparisonInput = {
  scope: SeoScope;
  definition: SeoDefinition;
  baseline: { search: SeoSearchDataset; landing?: SeoLandingDataset };
  current: { search: SeoSearchDataset; landing?: SeoLandingDataset };
  mappings: readonly SeoPageMapping[];
  changes: readonly { at: string; label: string; sourceRef: string }[];
};
export type SeoPeriodValue = {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  position: number | null;
  sessions: number | null;
  outcomes: number | null;
  valueRate: number | null;
  lcpP75: number | null;
  reasons: string[];
  mappingRefs: string[];
};
export type SeoComparisonRow = {
  pageId: string;
  template: string;
  locale: string;
  device: string;
  baseline: SeoPeriodValue | null;
  current: SeoPeriodValue | null;
  candidates: string[];
  reasons: string[];
};
export type SeoComparisonReport = {
  definition: SeoDefinition;
  inputHash: string;
  scope: SeoScope;
  state: "ready" | "partial" | "empty";
  rows: SeoComparisonRow[];
  population: number;
  included: number;
  excluded: number;
  sources: (SeoMetadata & { rowCount: number })[];
  unmappedRows: number;
  missingQueryRows: number;
  anonymousQueryRows: number;
  diagnostics: string[];
  assumptions: string[];
  changes: SeoComparisonInput["changes"];
};
export class SeoComparisonProblem extends Problem {
  constructor(readonly field: string) {
    super(
      "metrics-core/seo-invalid-input",
      ProblemCategory.ValidationError,
      `Invalid SEO field: ${field}`,
    );
  }
}
export function requireSeo(condition: unknown, field: string): asserts condition {
  if (!condition) throw new SeoComparisonProblem(field);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function seoScopeKey(scope: SeoScope): string {
  requireSeo(scope && [scope.app, scope.environment, scope.tenant].every(text), "scope");
  return JSON.stringify([scope.app, scope.environment, scope.tenant]);
}
function timestamp(value: string): number {
  requireSeo(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value),
    "instant",
  );
  const n = Date.parse(value);
  requireSeo(
    Number.isFinite(n) && new Date(n).toISOString().slice(0, 19) === value.slice(0, 19),
    "instant",
  );
  return n;
}
function windowSize(window: SeoWindow): number {
  requireSeo(window && timestamp(window.to) > timestamp(window.from), "window");
  return timestamp(window.to) - timestamp(window.from);
}
function sameWindow(a: SeoWindow, b: SeoWindow): boolean {
  return timestamp(a.from) === timestamp(b.from) && timestamp(a.to) === timestamp(b.to);
}
function contains(a: SeoWindow, b: SeoWindow): boolean {
  return timestamp(a.from) <= timestamp(b.from) && timestamp(a.to) >= timestamp(b.to);
}
function count(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}
function measure(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}
function metadata(meta: SeoMetadata, scope: SeoScope, unit: SeoMetadata["unit"]): void {
  requireSeo(meta && seoScopeKey(meta.scope) === seoScopeKey(scope), "dataset.scope");
  requireSeo(
    [
      meta.source,
      meta.sourceRevision,
      meta.definitionVersion,
      meta.denominator,
      meta.timezone,
    ].every(text),
    "metadata",
  );
  requireSeo(
    meta.unit === unit && ["page-device", "page-device-query"].includes(meta.grain),
    "metadata.unit-or-grain",
  );
  requireSeo(
    ["complete", "partial"].includes(meta.completeness) &&
      ["all-pages", "returned-rows"].includes(meta.coverage) &&
      ["ready", "error", "unavailable"].includes(meta.state),
    "metadata.quality",
  );
  windowSize(meta.window);
  try {
    new Intl.DateTimeFormat("en", { timeZone: meta.timezone }).format(0);
  } catch {
    throw new SeoComparisonProblem("timezone");
  }
  // Search daily windows are explicit UTC instants at midnight in the declared source timezone.
  const format = new Intl.DateTimeFormat("en", {
    timeZone: meta.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (const edge of [meta.window.from, meta.window.to]) {
    const parts = Object.fromEntries(
      format.formatToParts(timestamp(edge)).map((p) => [p.type, p.value]),
    );
    requireSeo(
      parts.hour === "00" &&
        parts.minute === "00" &&
        parts.second === "00" &&
        timestamp(edge) % 1000 === 0,
      "window.timezone-boundary",
    );
  }
  if (meta.grain === "page-device-query")
    requireSeo(meta.coverage === "returned-rows", "query.coverage");
}
/** Stable key order, preserving array order: callers provide immutable normalized source snapshots. */
export function seoCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(seoCanonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${seoCanonicalJson(v)}`)
      .join(",")}}`;
  const encoded = JSON.stringify(value);
  requireSeo(encoded !== undefined, "json");
  return encoded;
}
export async function hashSeoInput(value: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(seoCanonicalJson(value)),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function complete(meta: SeoMetadata): boolean {
  return (
    meta.state === "ready" && meta.completeness === "complete" && meta.coverage === "all-pages"
  );
}
function sumNullable(values: readonly (number | null)[]): number | null {
  if (values.some((v) => v === null)) return null;
  const sum = values.reduce<number>((a, v) => a + (v ?? 0), 0);
  requireSeo(Number.isSafeInteger(sum), "sum.overflow");
  return sum;
}
function ratio(n: number | null, d: number | null): number | null {
  return n !== null && d !== null && d > 0 ? n / d : null;
}
function semanticMatch(a: SeoMetadata, b: SeoMetadata): boolean {
  return (
    a.source === b.source &&
    a.definitionVersion === b.definitionVersion &&
    a.grain === b.grain &&
    a.unit === b.unit &&
    a.denominator === b.denominator &&
    a.timezone === b.timezone
  );
}
/** Validate a saved or requested declaration before selecting or reading its source frames. */
export function validateSeoDefinition(def: SeoDefinition): void {
  requireSeo(
    def &&
      text(def.id) &&
      text(def.version) &&
      ["all", "impressions-up-clicks-down", "value-rate-down"].includes(def.candidate),
    "definition",
  );
  requireSeo(
    [def.minImpressions, def.minSessions].every((v) => count(v) && v !== null),
    "definition.support",
  );
  requireSeo(
    typeof def.minImpressionGrowth === "number" &&
      Number.isFinite(def.minImpressionGrowth) &&
      def.minImpressionGrowth >= 0,
    "definition.threshold",
  );
  requireSeo(
    [def.minClickDecline, def.minValueRateDecline].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
    ),
    "definition.threshold",
  );
  requireSeo(
    Object.keys(def).every((key) =>
      [
        "id",
        "version",
        "baselineWindow",
        "currentWindow",
        "minImpressions",
        "minSessions",
        "minImpressionGrowth",
        "minClickDecline",
        "minValueRateDecline",
        "candidate",
      ].includes(key),
    ),
    "definition.keys",
  );
  for (const window of [def.baselineWindow, def.currentWindow]) {
    requireSeo(
      window &&
        typeof window === "object" &&
        !Array.isArray(window) &&
        Object.keys(window).every((key) => key === "from" || key === "to"),
      "definition.window",
    );
    windowSize(window);
  }
  requireSeo(timestamp(def.baselineWindow.to) <= timestamp(def.currentWindow.from), "period.order");
}

/** Pure aggregate comparison; never accepts purchaser identities or converts daily source timezones. */
export async function compareSeo(input: SeoComparisonInput): Promise<SeoComparisonReport> {
  input = structuredClone(input);
  seoScopeKey(input.scope);
  const def = input.definition;
  validateSeoDefinition(def);
  requireSeo(
    Array.isArray(input.mappings) &&
      input.mappings.length <= 20000 &&
      Array.isArray(input.changes) &&
      input.changes.length <= 1000,
    "input",
  );
  const mappingsByPage = new Map<string, SeoPageMapping[]>();
  for (const m of input.mappings) {
    requireSeo(m && [m.page, m.pageId, m.template, m.locale, m.sourceRef].every(text), "mapping");
    windowSize(m.effective);
    const entries = mappingsByPage.get(m.page) ?? [];
    entries.push(m);
    mappingsByPage.set(m.page, entries);
  }
  for (const change of input.changes) {
    timestamp(change.at);
    requireSeo(text(change.label) && text(change.sourceRef), "change");
  }
  requireSeo(
    sameWindow(def.baselineWindow, input.baseline.search.metadata.window) &&
      sameWindow(def.currentWindow, input.current.search.metadata.window),
    "definition.window",
  );
  const sources: (SeoMetadata & { rowCount: number })[] = [];
  const diagnostics = new Set<string>();
  let unmappedRows = 0,
    missingQueryRows = 0,
    anonymousQueryRows = 0;
  const periods = [input.baseline, input.current] as const;
  for (const period of periods) {
    metadata(period.search.metadata, input.scope, "search-counts");
    sources.push({ ...period.search.metadata, rowCount: period.search.rows.length });
    if (period.landing) {
      metadata(period.landing.metadata, input.scope, "landing-counts");
      sources.push({ ...period.landing.metadata, rowCount: period.landing.rows.length });
    }
  }
  const baseMeta = input.baseline.search.metadata,
    currentMeta = input.current.search.metadata;
  const compatible =
    semanticMatch(baseMeta, currentMeta) &&
    windowSize(baseMeta.window) === windowSize(currentMeta.window);
  if (!compatible) diagnostics.add("SEO_PERIOD_MISMATCH");
  if (
    input.baseline.landing &&
    input.current.landing &&
    !semanticMatch(input.baseline.landing.metadata, input.current.landing.metadata)
  )
    diagnostics.add("SEO_LANDING_DEFINITION_MISMATCH");
  const grouped = new Map<string, SeoComparisonRow>();
  for (const [index, period] of periods.entries()) {
    const search = period.search,
      meta = search.metadata;
    const landing = period.landing;
    const join =
      landing &&
      meta.grain === "page-device" &&
      landing.metadata.grain === "page-device" &&
      sameWindow(meta.window, landing.metadata.window) &&
      meta.timezone === landing.metadata.timezone;
    if (landing && !join) diagnostics.add("SEO_LANDING_PERIOD_OR_GRAIN_MISMATCH");
    for (const dataset of [search, ...(landing ? [landing] : [])]) {
      requireSeo(Array.isArray(dataset.rows) && dataset.rows.length <= 10000, "row-budget");
      requireSeo(
        dataset.metadata.state === "ready" || dataset.rows.length === 0,
        "source.failure-with-rows",
      );
      if (!complete(dataset.metadata))
        diagnostics.add(
          dataset.metadata.state === "error"
            ? "SEO_SOURCE_ERROR"
            : dataset.metadata.state === "unavailable"
              ? "SEO_SOURCE_UNAVAILABLE"
              : "SEO_PARTIAL_COVERAGE",
        );
    }
    const landingByKey = new Map<string, SeoLandingRow>();
    for (const row of landing?.rows ?? []) {
      requireSeo(
        row &&
          text(row.page) &&
          text(row.device) &&
          count(row.sessions) &&
          count(row.outcomes) &&
          measure(row.lcpP75),
        "landing.row",
      );
      requireSeo(
        row.sessions === null || row.outcomes === null || row.outcomes <= row.sessions,
        "landing.outcomes",
      );
      const k = JSON.stringify([row.page, row.device]);
      requireSeo(!landingByKey.has(k), "landing.duplicate");
      landingByKey.set(k, row);
    }
    const searchKeys = new Set(search.rows.map((row) => JSON.stringify([row.page, row.device])));
    if (join && [...landingByKey.keys()].some((key) => !searchKeys.has(key)))
      diagnostics.add("SEO_LANDING_ROWS_WITHOUT_SEARCH");
    const seen = new Set<string>();
    const buckets = new Map<
      string,
      {
        mapping: SeoPageMapping;
        device: string;
        rows: SeoSearchRow[];
        landings: SeoLandingRow[];
        refs: Set<string>;
      }
    >();
    for (const row of search.rows) {
      requireSeo(
        row &&
          text(row.page) &&
          text(row.device) &&
          count(row.impressions) &&
          count(row.clicks) &&
          measure(row.position),
        "search.row",
      );
      requireSeo(
        row.impressions === null || row.clicks === null || row.clicks <= row.impressions,
        "search.clicks",
      );
      requireSeo(row.query === undefined || row.query === null || text(row.query), "query");
      requireSeo(meta.grain === "page-device-query" || row.query === undefined, "query.grain");
      if (meta.grain === "page-device-query") {
        if (row.query === undefined) missingQueryRows++;
        else if (row.query === null) anonymousQueryRows++;
      }
      const identity = JSON.stringify([
        row.page,
        row.device,
        row.query === undefined ? ["missing"] : row.query,
      ]);
      requireSeo(!seen.has(identity), "search.duplicate");
      seen.add(identity);
      const maps = (mappingsByPage.get(row.page) ?? []).filter(
        (m) =>
          timestamp(m.effective.from) < timestamp(meta.window.to) &&
          timestamp(meta.window.from) < timestamp(m.effective.to),
      );
      requireSeo(maps.length <= 1, "mapping.ambiguous");
      const mapping = maps.find((m) => contains(m.effective, meta.window));
      if (!mapping) {
        unmappedRows++;
        diagnostics.add("SEO_MAPPING_UNAVAILABLE");
        continue;
      }
      const key = JSON.stringify([mapping.pageId, mapping.template, mapping.locale, row.device]);
      const bucket = buckets.get(key) ?? {
        mapping,
        device: row.device,
        rows: [] as SeoSearchRow[],
        landings: [] as SeoLandingRow[],
        refs: new Set<string>(),
      };
      bucket.rows.push(row);
      bucket.refs.add(mapping.sourceRef);
      const land = join ? landingByKey.get(JSON.stringify([row.page, row.device])) : undefined;
      if (land) bucket.landings.push(land);
      buckets.set(key, bucket);
    }
    for (const [key, bucket] of buckets) {
      const reasons: string[] = [];
      if (!complete(meta)) reasons.push("SEO_SEARCH_PARTIAL");
      if (meta.grain === "page-device-query") reasons.push("SEO_QUERY_ROWS_NOT_SEARCH_POPULATION");
      const impressions = sumNullable(bucket.rows.map((r) => r.impressions)),
        clicks = sumNullable(bucket.rows.map((r) => r.clicks));
      if (impressions === 0) reasons.push("SEO_ZERO_IMPRESSIONS");
      if (impressions === null || clicks === null) reasons.push("SEO_SEARCH_MISSING");
      const hasLanding =
        join &&
        landing?.metadata.state === "ready" &&
        bucket.landings.length === bucket.rows.length;
      if (!hasLanding) reasons.push("SEO_LANDING_UNAVAILABLE");
      else if (!complete(landing.metadata)) reasons.push("SEO_LANDING_PARTIAL");
      const sessions = hasLanding ? sumNullable(bucket.landings.map((r) => r.sessions)) : null;
      const outcomes = hasLanding ? sumNullable(bucket.landings.map((r) => r.outcomes)) : null;
      if (sessions === 0) reasons.push("SEO_ZERO_SESSIONS");
      if (sessions === null || outcomes === null) reasons.push("SEO_LANDING_MISSING");
      if (bucket.rows.length > 1) reasons.push("SEO_POSITION_GRAIN_UNAVAILABLE");
      if (bucket.landings.length > 1) reasons.push("SEO_PERCENTILE_GRAIN_UNAVAILABLE");
      const value: SeoPeriodValue = {
        impressions,
        clicks,
        ctr: ratio(clicks, impressions),
        position: bucket.rows.length === 1 ? bucket.rows[0].position : null,
        sessions,
        outcomes,
        valueRate: ratio(outcomes, sessions),
        lcpP75: hasLanding && bucket.landings.length === 1 ? bucket.landings[0].lcpP75 : null,
        reasons,
        mappingRefs: [...bucket.refs].sort(),
      };
      const row = grouped.get(key) ?? {
        pageId: bucket.mapping.pageId,
        template: bucket.mapping.template,
        locale: bucket.mapping.locale,
        device: bucket.device,
        baseline: null,
        current: null,
        candidates: [],
        reasons: [],
      };
      if (index === 0) row.baseline = value;
      else row.current = value;
      grouped.set(key, row);
    }
  }
  const all = [...grouped.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, r]) => r);
  for (const row of all) {
    const b = row.baseline,
      c = row.current;
    if (!compatible) row.reasons.push("SEO_PERIOD_MISMATCH");
    if (!b || !c) row.reasons.push("SEO_PERIOD_ROW_MISSING");
    if (b && c && compatible) {
      const searchReady = periods.every(
        (p) => complete(p.search.metadata) && p.search.metadata.grain === "page-device",
      );
      if (!searchReady) row.reasons.push("SEO_SEARCH_INCOMPARABLE");
      else if (
        b.impressions !== null &&
        c.impressions !== null &&
        b.clicks !== null &&
        c.clicks !== null &&
        b.impressions >= def.minImpressions &&
        c.impressions >= def.minImpressions &&
        b.impressions > 0 &&
        b.clicks > 0 &&
        c.impressions > b.impressions &&
        c.clicks < b.clicks &&
        (c.impressions - b.impressions) / b.impressions >= def.minImpressionGrowth &&
        (b.clicks - c.clicks) / b.clicks >= def.minClickDecline
      )
        row.candidates.push("impressions-up-clicks-down");
      const landReady = periods.every(
        (p) =>
          p.landing &&
          complete(p.landing.metadata) &&
          semanticMatch(input.baseline.landing?.metadata ?? p.landing.metadata, p.landing.metadata),
      );
      if (
        searchReady &&
        landReady &&
        b.valueRate !== null &&
        c.valueRate !== null &&
        b.sessions !== null &&
        c.sessions !== null &&
        b.sessions >= def.minSessions &&
        c.sessions >= def.minSessions &&
        b.valueRate > 0 &&
        c.valueRate < b.valueRate &&
        (b.valueRate - c.valueRate) / b.valueRate >= def.minValueRateDecline
      )
        row.candidates.push("value-rate-down");
    }
  }
  const rows =
    def.candidate === "all" ? all : all.filter((r) => r.candidates.includes(def.candidate));
  const partial =
    diagnostics.size > 0 ||
    all.some(
      (r) =>
        r.reasons.length > 0 ||
        [r.baseline, r.current].some(
          (p) =>
            p && p.reasons.some((r) => !["SEO_ZERO_IMPRESSIONS", "SEO_ZERO_SESSIONS"].includes(r)),
        ),
    );
  return {
    definition: def,
    inputHash: await hashSeoInput(input),
    scope: input.scope,
    state: partial ? "partial" : all.length ? "ready" : "empty",
    rows,
    population: all.length,
    included: rows.length,
    excluded: all.length - rows.length,
    sources,
    unmappedRows,
    missingQueryRows,
    anonymousQueryRows,
    diagnostics: [...diagnostics].sort(),
    assumptions: [
      "Search clicks and landing sessions have different populations.",
      "Query rows are returned coverage, never the complete search population.",
      "Change markers show correlation, not causation.",
    ],
    changes: input.changes,
  };
}
