import { describe, expect, it } from "vitest";
import { compareSeo, SeoComparisonProblem } from "../libs/seo/SeoComparison";
import { collectSeoSource, importSeoSearch } from "../libs/seo/SeoSources";
import { seoFixtureInput } from "../../../../examples/seo-workbench/src/input";
import type { SourceSchema } from "@croco/etl-core/source";

async function* rows(values: readonly Record<string, unknown>[]) {
  yield* values;
}
async function* bytes(value: string) {
  yield new TextEncoder().encode(value);
}
describe("SeoComparison", () => {
  it("computes independent page CTR and value rates with unequal click/session populations", async () => {
    const report = await compareSeo(seoFixtureInput());
    expect(report.state).toBe("ready");
    expect(report.population).toBe(2);
    const start = report.rows.find((r) => r.pageId === "start");
    expect(start).toMatchObject({
      baseline: {
        impressions: 100,
        clicks: 20,
        ctr: 0.2,
        sessions: 17,
        outcomes: 5,
        valueRate: 5 / 17,
        position: 3.5,
      },
      current: {
        impressions: 200,
        clicks: 10,
        ctr: 0.05,
        sessions: 13,
        outcomes: 1,
        valueRate: 1 / 13,
        lcpP75: 2800,
      },
      candidates: ["impressions-up-clicks-down", "value-rate-down"],
    });
    expect(report.rows.find((r) => r.pageId === "docs")?.current?.ctr).toBe(0.019);
    expect(JSON.stringify(report)).not.toContain("private=hidden");
  });
  it("changes actual candidate membership, support/exclusions and reproducible input identity", async () => {
    const input = seoFixtureInput();
    input.definition.candidate = "impressions-up-clicks-down";
    const first = await compareSeo(input);
    expect(first).toMatchObject({ population: 2, included: 1, excluded: 1 });
    expect((await compareSeo(structuredClone(input))).inputHash).toBe(first.inputHash);
    input.definition.minImpressions = 150;
    expect(await compareSeo(input)).toMatchObject({ included: 0, excluded: 2 });
    expect((await compareSeo(input)).inputHash).not.toBe(first.inputHash);
  });
  it("does not average source positions or percentiles when canonical aliases coalesce", async () => {
    const input = seoFixtureInput();
    const alias = {
      ...input.current.search.rows[0],
      page: "alias",
      impressions: 50,
      clicks: 2,
      position: 1,
    };
    input.current.search.rows = [...input.current.search.rows, alias];
    if (input.current.landing)
      input.current.landing.rows = [
        ...input.current.landing.rows,
        { page: "alias", device: "MOBILE", sessions: 3, outcomes: 0, lcpP75: 500 },
      ];
    input.mappings = [...input.mappings, { ...input.mappings[0], page: "alias" }];
    const row = (await compareSeo(input)).rows.find((r) => r.pageId === "start");
    expect(row?.current).toMatchObject({
      impressions: 250,
      clicks: 12,
      ctr: 12 / 250,
      sessions: 16,
      outcomes: 1,
      position: null,
      lcpP75: null,
    });
  });
  it("keeps zero denominators, missing values and absent period rows distinct", async () => {
    const input = seoFixtureInput();
    input.current.search.rows = [
      { ...input.current.search.rows[0], impressions: 0, clicks: 0, position: null },
    ];
    if (input.current.landing)
      input.current.landing.rows = [
        { ...input.current.landing.rows[0], sessions: 0, outcomes: 0, lcpP75: null },
      ];
    let report = await compareSeo(input);
    let start = report.rows.find((r) => r.pageId === "start");
    expect(start?.current).toMatchObject({
      ctr: null,
      valueRate: null,
      reasons: expect.arrayContaining(["SEO_ZERO_IMPRESSIONS", "SEO_ZERO_SESSIONS"]),
    });
    expect(report.rows.find((r) => r.pageId === "docs")?.current).toBeNull();
    input.current.search.rows = [{ ...input.current.search.rows[0], impressions: null }];
    report = await compareSeo(input);
    start = report.rows.find((r) => r.pageId === "start");
    expect(start?.current?.reasons).toContain("SEO_SEARCH_MISSING");
    expect(start?.candidates).toEqual([]);
  });
  it("separates KST landing windows from PT search without converting daily values", async () => {
    const input = seoFixtureInput();
    if (input.current.landing) {
      input.current.landing.metadata.timezone = "Asia/Seoul";
      input.current.landing.metadata.window = {
        from: "2026-10-01T15:00:00Z",
        to: "2026-10-02T15:00:00Z",
      };
    }
    const report = await compareSeo(input);
    expect(report.diagnostics).toContain("SEO_LANDING_PERIOD_OR_GRAIN_MISMATCH");
    expect(report.rows.find((r) => r.pageId === "start")?.current?.sessions).toBeNull();
    expect(report.rows.find((r) => r.pageId === "start")?.candidates).not.toContain(
      "value-rate-down",
    );
  });
  it("rejects mislabeled timezone boundaries, scope leakage, duplicate grain and overlapping mappings", async () => {
    for (const kind of ["timezone", "scope", "duplicate", "mapping"] as const) {
      const input = seoFixtureInput();
      if (kind === "timezone") input.current.search.metadata.timezone = "Asia/Seoul";
      if (kind === "scope")
        input.current.search.metadata.scope = { ...input.scope, tenant: "other" };
      if (kind === "duplicate")
        input.current.search.rows = [...input.current.search.rows, input.current.search.rows[0]];
      if (kind === "mapping") input.mappings = [...input.mappings, input.mappings[0]];
      await expect(compareSeo(input)).rejects.toBeInstanceOf(SeoComparisonProblem);
    }
  });
  it("preserves anonymous and missing query coverage without joining query groups to outcomes", async () => {
    const input = seoFixtureInput();
    for (const period of [input.baseline, input.current]) {
      period.search.metadata.grain = "page-device-query";
      period.search.metadata.coverage = "returned-rows";
      period.search.rows = [
        { ...period.search.rows[0], query: null },
        { ...period.search.rows[0], query: undefined, impressions: 50, clicks: 3 },
        { ...period.search.rows[0], query: "synthetic query", impressions: 20, clicks: 1 },
      ];
    }
    const report = await compareSeo(input);
    expect(report).toMatchObject({ state: "partial", missingQueryRows: 2, anonymousQueryRows: 2 });
    expect(report.rows[0]).toMatchObject({
      baseline: { sessions: null, outcomes: null },
      current: { sessions: null, outcomes: null },
      candidates: [],
    });
    expect(JSON.stringify(report)).not.toContain("synthetic query");
  });
  it.each(["partial", "error", "unavailable"] as const)(
    "preserves %s source quality and excludes unsupported candidates",
    async (kind) => {
      const input = seoFixtureInput();
      if (kind === "partial") input.current.search.metadata.completeness = "partial";
      else {
        input.current.search.metadata.state = kind;
        input.current.search.rows = [];
      }
      const report = await compareSeo(input);
      expect(report.state).toBe("partial");
      expect(report.rows.every((r) => r.candidates.length === 0)).toBe(true);
      expect(report.diagnostics).toContain(
        kind === "partial"
          ? "SEO_PARTIAL_COVERAGE"
          : kind === "error"
            ? "SEO_SOURCE_ERROR"
            : "SEO_SOURCE_UNAVAILABLE",
      );
    },
  );
  it("uses shared CSV and JSONL parsing with identical semantic rows and line-position failures", async () => {
    const input = seoFixtureInput();
    const fields: SourceSchema["fields"] = [
      { name: "page", type: "string" },
      { name: "device", type: "string" },
      { name: "impressions", type: "number" },
      { name: "clicks", type: "number" },
      { name: "position", type: "number", nullable: true },
    ];
    const schema: SourceSchema = {
      format: "jsonl",
      encoding: "utf-8",
      fields,
      limits: { maxBytes: 10000, maxRecords: 10, maxRowBytes: 1000 },
    };
    const original = input.current.search.rows;
    const decoded = await importSeoSearch(
      bytes(original.map((r) => JSON.stringify(r)).join("\n")),
      schema,
      {},
      10,
    );
    expect(decoded).toEqual(await collectSeoSource(rows(original), "search", {}, 10));
    input.current.search.rows = decoded;
    expect(await compareSeo(input)).toEqual(await compareSeo(seoFixtureInput()));
    const csv = await importSeoSearch(
      bytes(
        "page,device,impressions,clicks,position\nhttps://synthetic.invalid/docs,DESKTOP,1000,19,6\n",
      ),
      { ...schema, format: "csv", header: true },
      {},
      10,
    );
    expect(csv).toEqual([original[1]]);
    await expect(importSeoSearch(bytes('{"page":'), schema, {}, 10)).rejects.toMatchObject({
      code: expect.stringContaining("source"),
    });
    await expect(collectSeoSource(rows(original), "search", {}, 1)).rejects.toMatchObject({
      field: "source.row-budget",
    });
  });
});

describe("SeoComparison mapping and definition boundaries", () => {
  it.each(["search", "landing"] as const)(
    "joins a %s alias through the effective page mapping",
    async (source) => {
      const input = seoFixtureInput();
      input.mappings = [
        ...input.mappings,
        { ...input.mappings[0], page: "alias", sourceRef: "alias-registry" },
      ];
      for (const period of [input.baseline, input.current]) {
        if (source === "search")
          period.search.rows = period.search.rows.map((row, i) =>
            i === 0 ? { ...row, page: "alias" } : row,
          );
        else if (period.landing)
          period.landing.rows = period.landing.rows.map((row, i) =>
            i === 0 ? { ...row, page: "alias" } : row,
          );
      }
      const report = await compareSeo(input);
      expect(report.diagnostics).not.toContain("SEO_LANDING_ROWS_WITHOUT_SEARCH");
      expect(report.rows.find((row) => row.pageId === "start")).toMatchObject({
        baseline: {
          sessions: 17,
          outcomes: 5,
          valueRate: 5 / 17,
          mappingRefs: ["alias-registry", "registry-v3"],
        },
        current: { sessions: 13, outcomes: 1, valueRate: 1 / 13, lcpP75: 2800 },
        candidates: ["impressions-up-clicks-down", "value-rate-down"],
      });
    },
  );
  it("aggregates each mapped landing row once independently of search alias counts", async () => {
    const input = seoFixtureInput();
    input.mappings = [...input.mappings, { ...input.mappings[0], page: "alias" }];
    input.current.search.rows = [
      ...input.current.search.rows,
      { ...input.current.search.rows[0], page: "alias", impressions: 50, clicks: 2 },
    ];
    let row = (await compareSeo(input)).rows.find((r) => r.pageId === "start");
    expect(row?.current).toMatchObject({
      impressions: 250,
      sessions: 13,
      outcomes: 1,
      lcpP75: 2800,
    });
    input.current.search.rows = input.current.search.rows.filter((r) => r.page !== "alias");
    if (input.current.landing)
      input.current.landing.rows = [
        ...input.current.landing.rows,
        { page: "alias", device: "MOBILE", sessions: 7, outcomes: 2, lcpP75: 700 },
      ];
    row = (await compareSeo(input)).rows.find((r) => r.pageId === "start");
    expect(row?.current).toMatchObject({
      impressions: 200,
      sessions: 20,
      outcomes: 3,
      valueRate: 3 / 20,
      lcpP75: null,
    });
    expect(row?.current?.reasons).toContain("SEO_PERCENTILE_GRAIN_UNAVAILABLE");
  });
  it.each(["device", "template", "locale", "expired"] as const)(
    "does not join landing aliases across a different %s",
    async (difference) => {
      const input = seoFixtureInput();
      const mapping = { ...input.mappings[0], page: "alias" };
      if (difference === "template") mapping.template = "other";
      if (difference === "locale") mapping.locale = "fr";
      if (difference === "expired")
        mapping.effective = { ...mapping.effective, to: input.definition.currentWindow.from };
      input.mappings = [...input.mappings, mapping];
      if (input.current.landing)
        input.current.landing.rows = input.current.landing.rows.map((row, i) =>
          i === 0
            ? { ...row, page: "alias", device: difference === "device" ? "DESKTOP" : row.device }
            : row,
        );
      const report = await compareSeo(input);
      expect(report.rows.find((r) => r.pageId === "start")?.current?.sessions).toBeNull();
      expect(report.diagnostics).toContain("SEO_LANDING_ROWS_WITHOUT_SEARCH");
    },
  );
  it("rejects ambiguous mappings used only by landing aliases", async () => {
    const input = seoFixtureInput();
    input.mappings = [
      ...input.mappings,
      { ...input.mappings[0], page: "alias" },
      { ...input.mappings[0], page: "alias", pageId: "other" },
    ];
    if (input.current.landing)
      input.current.landing.rows = input.current.landing.rows.map((row, i) =>
        i === 0 ? { ...row, page: "alias" } : row,
      );
    await expect(compareSeo(input)).rejects.toMatchObject({ field: "mapping.ambiguous" });
  });
  it("excludes mappings that cannot cover a whole source window and shows unmatched landing coverage", async () => {
    const input = seoFixtureInput();
    input.mappings = input.mappings.map((m) =>
      m.pageId === "start"
        ? { ...m, effective: { ...m.effective, to: "2026-10-02T07:00:00Z" } }
        : m,
    );
    const report = await compareSeo(input);
    expect(report).toMatchObject({ state: "partial", unmappedRows: 1 });
    expect(report.rows.find((r) => r.pageId === "start")).toMatchObject({
      current: null,
      reasons: ["SEO_PERIOD_ROW_MISSING"],
    });
    input.current.search.rows = [];
    expect((await compareSeo(input)).diagnostics).toContain("SEO_LANDING_ROWS_WITHOUT_SEARCH");
  });
  it("separates changed landing definitions instead of treating different rates as comparable", async () => {
    const input = seoFixtureInput();
    if (input.current.landing)
      input.current.landing.metadata.denominator = "all visits, different definition";
    const report = await compareSeo(input);
    expect(report.diagnostics).toContain("SEO_LANDING_DEFINITION_MISMATCH");
    expect(report.rows.find((r) => r.pageId === "start")?.candidates).toEqual([
      "impressions-up-clicks-down",
    ]);
  });
});

describe("SeoComparison declared periods", () => {
  it("rejects a selected period that does not match the normalized source instead of relabeling its counts", async () => {
    const input = seoFixtureInput();
    input.definition.baselineWindow = {
      from: "2026-09-30T07:00:00.000Z",
      to: "2026-10-01T07:00:00.000Z",
    };
    await expect(compareSeo(input)).rejects.toMatchObject({ field: "definition.window" });
  });
});

describe("SeoComparison relative growth thresholds", () => {
  it("supports growth thresholds above 100 percent without confusing relative changes with percentage points", async () => {
    const input = seoFixtureInput();
    input.definition.minImpressionGrowth = 2;
    input.definition.candidate = "impressions-up-clicks-down";
    expect(await compareSeo(input)).toMatchObject({ included: 0, excluded: 2 });
    input.current.search.rows = input.current.search.rows.map((row, index) =>
      index === 0 ? { ...row, impressions: 400 } : row,
    );
    expect(await compareSeo(input)).toMatchObject({
      included: 1,
      rows: [{ pageId: "start", current: { impressions: 400, clicks: 10, ctr: 0.025 } }],
    });
  });
});

describe("SeoComparison effective mapping conflicts", () => {
  it("rejects a conflicting mapping that overlaps only part of a source window", async () => {
    const input = seoFixtureInput();
    input.mappings = [
      ...input.mappings,
      {
        ...input.mappings[0],
        pageId: "reassigned-page",
        effective: { from: "2026-10-01T19:00:00Z", to: "2026-10-02T07:00:00Z" },
      },
    ];
    await expect(compareSeo(input)).rejects.toMatchObject({ field: "mapping.ambiguous" });
  });
  it("does not conflict with a mapping starting at the exclusive end of both source windows", async () => {
    const input = seoFixtureInput();
    input.mappings = [
      ...input.mappings,
      {
        ...input.mappings[0],
        pageId: "future-page",
        effective: { from: "2026-10-03T07:00:00Z", to: "2026-10-04T07:00:00Z" },
      },
    ];
    expect((await compareSeo(input)).rows.find((row) => row.pageId === "start")).toBeDefined();
  });
});
