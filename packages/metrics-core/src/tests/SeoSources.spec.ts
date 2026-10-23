import { describe, expect, it, vi } from "vitest";
import { MetricReadService } from "../libs/read/MetricReadService";
import { parseSeoReport, registerSeoQuery, normalizeSeoRow } from "../libs/seo/SeoSources";
import { compareSeo } from "../libs/seo/SeoComparison";
import {
  seoFixtureInput,
  seoDefinition,
  seoScope,
} from "../../../../examples/seo-workbench/src/input";
import type {
  MetricReadBudget,
  MetricReadQuality,
  MetricReadContext,
} from "../libs/read/MetricReadService";
import type { SeoColumnBinding } from "../libs/seo/SeoSources";

const limits: MetricReadBudget = {
  maxRows: 100,
  maxBytes: 100000,
  maxCost: 100,
  maxConcurrency: 2,
  maxTimeMs: 5000,
  maxWindowMs: 4 * 86400000,
};
const quality: MetricReadQuality = {
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  freshness: "fresh",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
const revisions = [
  { sourceRef: "search", revision: "snapshot-v1" },
  { sourceRef: "events", revision: "snapshot-v1" },
];
const window = { from: "2026-10-01T07:00:00.000Z", to: "2026-10-03T07:00:00.000Z" };
async function setup() {
  const input = seoFixtureInput();
  let allowed = true,
    privacy = "1";
  const context: MetricReadContext = {
    principal: { ...seoScope, subject: "operator" },
    allowedFields: ["seo.pages"],
    allowRaw: false,
    budget: limits,
    sourceRevisions: revisions,
    snapshotRefs: ["search-snapshot", "event-snapshot"],
  };
  const source = vi.fn(async () => ({ input, quality }));
  const reg = await registerSeoQuery({
    queryId: "seo",
    queryVersion: 1,
    scope: seoScope,
    definition: seoDefinition,
    sourceRevisions: revisions,
    limits,
    requiredFields: ["seo.pages"],
    source,
  });
  const service = new MetricReadService([reg.definition], [reg.query], {
    currentContext: () => context,
    authorize: async () => (allowed ? { permissionEpoch: "1", privacyEpoch: privacy } : null),
  });
  return {
    input,
    context,
    source,
    service,
    deny: () => {
      allowed = false;
    },
    revoke: () => {
      privacy = "2";
    },
  };
}
describe("SeoSources", () => {
  it("executes the same calculation through the shared runner and carries partial quality with stable diagnostics", async () => {
    const f = await setup();
    let outcome = await f.service.runRegisteredQuery("seo", null, window);
    expect(outcome.status).toBe("verified");
    expect("result" in outcome ? outcome.result?.data : null).toEqual(await compareSeo(f.input));
    f.input.current.search.metadata.completeness = "partial";
    outcome = await f.service.runRegisteredQuery("seo", null, window);
    expect(outcome.status).toBe("partial");
    expect("result" in outcome ? outcome.result?.quality.temporalCompleteness : null).toBe(
      "partial",
    );
  });
  it("denies before loading without grants and discards data after in-flight privacy revocation", async () => {
    const f = await setup();
    f.deny();
    expect(await f.service.runRegisteredQuery("seo", null, window)).toMatchObject({
      status: "denied",
    });
    expect(f.source).not.toHaveBeenCalled();
    const g = await setup();
    g.source.mockImplementation(async () => {
      g.revoke();
      return { input: g.input, quality };
    });
    expect(await g.service.runRegisteredQuery("seo", null, window)).toMatchObject({
      status: "denied",
    });
  });
  it("rejects source revision/scope drift and oversized inputs through the production query path", async () => {
    for (const kind of ["revision", "scope", "budget"] as const) {
      const f = await setup();
      if (kind === "revision") f.input.current.search.metadata.sourceRevision = "other";
      if (kind === "scope") f.input.scope = { ...seoScope, tenant: "other" };
      if (kind === "budget")
        f.input.current.search.rows = Array.from({ length: 101 }, (_, i) => ({
          ...f.input.current.search.rows[0],
          page: `page-${i}`,
        }));
      await expect(f.service.runRegisteredQuery("seo", null, window)).rejects.toThrow();
    }
  });
  it("normalizes exact provider numeric strings and rejects unsafe counts or coercion", () => {
    const row = { page: "p", device: "MOBILE", clicks: "3", impressions: "100", position: "4.25" };
    expect(normalizeSeoRow(row, "search", {})).toEqual({
      page: "p",
      device: "MOBILE",
      clicks: 3,
      impressions: 100,
      position: 4.25,
    });
    for (const impressions of ["9007199254740993", "", false, "1e2"])
      expect(() => normalizeSeoRow({ ...row, impressions }, "search", {})).toThrow();
  });
  it("rejects extra payload fields and corrupted ratios when reading verified reports", async () => {
    const report = await compareSeo(seoFixtureInput());
    expect(parseSeoReport(report)).toEqual(report);
    expect(() => parseSeoReport({ ...report, rawQuery: "hidden" })).toThrow();
    const row = report.rows[0];
    if (row.current) row.current.ctr = 0.8;
    expect(() => parseSeoReport(report)).toThrow();
  });
});

describe("SeoSources comparison union bound", () => {
  it("accepts the bounded union of disjoint baseline and current page populations", async () => {
    const input = seoFixtureInput();
    delete input.baseline.landing;
    delete input.current.landing;
    input.baseline.search.rows = Array.from({ length: 5000 }, (_, i) => ({
      page: `baseline-${i}`,
      device: "MOBILE",
      impressions: 10,
      clicks: 1,
      position: 2,
    }));
    input.current.search.rows = Array.from({ length: 5001 }, (_, i) => ({
      page: `current-${i}`,
      device: "MOBILE",
      impressions: 20,
      clicks: 3,
      position: 4,
    }));
    input.mappings = [...input.baseline.search.rows, ...input.current.search.rows].map((row) => ({
      page: row.page,
      pageId: row.page,
      template: "landing",
      locale: "en",
      sourceRef: "registry",
      effective: { from: "2026-09-01T00:00:00Z", to: "2027-01-01T00:00:00Z" },
    }));
    const report = await compareSeo(input);
    expect(report.population).toBe(10001);
    expect(parseSeoReport(report).rows).toHaveLength(10001);
  }, 15000);
});

describe("SeoSources independent quality axes", () => {
  it("marks returned population coverage partial without inventing an incomplete time window", async () => {
    const f = await setup();
    f.input.current.search.metadata.coverage = "returned-rows";
    const outcome = await f.service.runRegisteredQuery("seo", null, window);
    expect(outcome).toMatchObject({
      status: "partial",
      result: { quality: { temporalCompleteness: "complete", populationCoverage: "partial" } },
    });
  });
  it("preserves complete population coverage when only the source time window is provisional", async () => {
    const f = await setup();
    f.input.current.search.metadata.completeness = "partial";
    const outcome = await f.service.runRegisteredQuery("seo", null, window);
    expect(outcome).toMatchObject({
      status: "partial",
      result: { quality: { temporalCompleteness: "partial", populationCoverage: "complete" } },
    });
  });
});

describe("SeoSources declared column semantics", () => {
  it("uses explicit source columns rather than accidentally reading similarly named defaults", () => {
    const binding = {
      page: "canonical_url",
      clicks: "search_clicks",
    } satisfies SeoColumnBinding;
    expect(
      normalizeSeoRow(
        {
          canonical_url: "correct-page",
          page: "wrong-page",
          device: "MOBILE",
          search_clicks: "3",
          clicks: "90",
          impressions: "100",
          position: "4.25",
        },
        "search",
        binding,
      ),
    ).toEqual({
      page: "correct-page",
      device: "MOBILE",
      clicks: 3,
      impressions: 100,
      position: 4.25,
    });
    const misspelled: SeoColumnBinding = {
      // @ts-expect-error Semantic field names are closed; only source column names are arbitrary.
      impression: "raw_impressions",
    };
    void misspelled;
  });
});

describe("SeoSources period registration", () => {
  it("rejects malformed period declarations during registration before a raw loader can execute", async () => {
    const source = vi.fn(async () => ({ input: seoFixtureInput(), quality }));
    const definition = structuredClone(seoDefinition);
    definition.baselineWindow.from = "not-an-instant";
    await expect(
      registerSeoQuery({
        queryId: "bad-period",
        queryVersion: 1,
        definition,
        scope: seoScope,
        sourceRevisions: revisions,
        limits,
        requiredFields: ["seo.pages"],
        source,
      }),
    ).rejects.toThrow();
    expect(source).not.toHaveBeenCalled();
  });
});

describe("SeoSources integer lexemes", () => {
  it.each(["0.99999999999999999", "9007199254740991.1", "1.0"])(
    "rejects fractional count text before numeric rounding: %s",
    (count) => {
      expect(() =>
        normalizeSeoRow(
          { page: "p", device: "MOBILE", impressions: count, clicks: "0", position: "3.25" },
          "search",
          {},
        ),
      ).toThrow();
      expect(() =>
        normalizeSeoRow(
          { page: "p", device: "MOBILE", sessions: count, outcomes: "0", lcpP75: "1200.5" },
          "landing",
          {},
        ),
      ).toThrow();
    },
  );
  it("preserves safe integer counts and fractional source measurements", () => {
    expect(
      normalizeSeoRow(
        {
          page: "p",
          device: "MOBILE",
          impressions: "9007199254740991",
          clicks: "0",
          position: "3.25",
        },
        "search",
        {},
      ),
    ).toMatchObject({ impressions: Number.MAX_SAFE_INTEGER, clicks: 0, position: 3.25 });
    expect(
      normalizeSeoRow(
        { page: "p", device: "MOBILE", sessions: "1", outcomes: "0", lcpP75: "1200.5" },
        "landing",
        {},
      ),
    ).toMatchObject({ sessions: 1, outcomes: 0, lcpP75: 1200.5 });
  });
});
