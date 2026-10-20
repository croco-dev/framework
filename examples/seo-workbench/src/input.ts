import type { SeoComparisonInput, SeoDefinition, SeoMetadata } from "@croco/metrics-core";
export const seoScope = { app: "synthetic-seo", environment: "test", tenant: "tenant-a" };
export const seoDefinition: SeoDefinition = {
  baselineWindow: { from: "2026-10-01T07:00:00.000Z", to: "2026-10-02T07:00:00.000Z" },
  currentWindow: { from: "2026-10-02T07:00:00.000Z", to: "2026-10-03T07:00:00.000Z" },
  id: "search-landing",
  version: "v1",
  minImpressions: 10,
  minSessions: 10,
  minImpressionGrowth: 0.1,
  minClickDecline: 0.1,
  minValueRateDecline: 0.1,
  candidate: "all",
};
export function seoFixtureInput(): SeoComparisonInput {
  const meta = (current: boolean, landing = false): SeoMetadata => ({
    scope: { ...seoScope },
    source: landing ? "events" : "search",
    sourceRevision: "snapshot-v1",
    definitionVersion: "v1",
    timezone: "America/Los_Angeles",
    window: {
      from: current ? "2026-10-02T07:00:00Z" : "2026-10-01T07:00:00Z",
      to: current ? "2026-10-03T07:00:00Z" : "2026-10-02T07:00:00Z",
    },
    grain: "page-device",
    unit: landing ? "landing-counts" : "search-counts",
    denominator: landing ? "landing sessions" : "search impressions",
    completeness: "complete",
    coverage: "all-pages",
    state: "ready",
  });
  return {
    scope: { ...seoScope },
    definition: structuredClone(seoDefinition),
    baseline: {
      search: {
        metadata: meta(false),
        rows: [
          {
            page: "https://synthetic.invalid/start?private=hidden",
            device: "MOBILE",
            impressions: 100,
            clicks: 20,
            position: 3.5,
          },
          {
            page: "https://synthetic.invalid/docs",
            device: "DESKTOP",
            impressions: 900,
            clicks: 9,
            position: 7,
          },
        ],
      },
      landing: {
        metadata: meta(false, true),
        rows: [
          {
            page: "https://synthetic.invalid/start?private=hidden",
            device: "MOBILE",
            sessions: 17,
            outcomes: 5,
            lcpP75: 1200,
          },
          {
            page: "https://synthetic.invalid/docs",
            device: "DESKTOP",
            sessions: 8,
            outcomes: 2,
            lcpP75: 2000,
          },
        ],
      },
    },
    current: {
      search: {
        metadata: meta(true),
        rows: [
          {
            page: "https://synthetic.invalid/start?private=hidden",
            device: "MOBILE",
            impressions: 200,
            clicks: 10,
            position: 4.5,
          },
          {
            page: "https://synthetic.invalid/docs",
            device: "DESKTOP",
            impressions: 1000,
            clicks: 19,
            position: 6,
          },
        ],
      },
      landing: {
        metadata: meta(true, true),
        rows: [
          {
            page: "https://synthetic.invalid/start?private=hidden",
            device: "MOBILE",
            sessions: 13,
            outcomes: 1,
            lcpP75: 2800,
          },
          {
            page: "https://synthetic.invalid/docs",
            device: "DESKTOP",
            sessions: 16,
            outcomes: 4,
            lcpP75: 1800,
          },
        ],
      },
    },
    mappings: [
      ["https://synthetic.invalid/start?private=hidden", "start", "landing"],
      ["https://synthetic.invalid/docs", "docs", "documentation"],
    ].map(([page, pageId, template]) => ({
      page,
      pageId,
      template,
      locale: "en",
      effective: { from: "2026-09-01T00:00:00Z", to: "2027-01-01T00:00:00Z" },
      sourceRef: "registry-v3",
    })),
    changes: [
      { at: "2026-10-02T08:00:00Z", label: "Synthetic copy revision", sourceRef: "content-v4" },
    ],
  };
}
