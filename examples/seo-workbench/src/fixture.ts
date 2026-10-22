import { compareSeo, SeoComparisonProblem } from "@croco/metrics-core";
import { MetricReadService, registerSeoQuery } from "@croco/metrics-core/runtime";
import { createSeoWorkbench } from "@croco/admin-core";
import type { SeoComparisonInput } from "@croco/metrics-core";
import type { SeoAccess, SeoSavedReport } from "@croco/admin-core";
import type {
  MetricReadAction,
  MetricReadBudget,
  MetricReadQuality,
} from "@croco/metrics-core/runtime";

import { seoScope, seoFixtureInput } from "./input";
export { seoScope, seoDefinition, seoFixtureInput } from "./input";
export const seoLimits: MetricReadBudget = {
  maxRows: 10000,
  maxBytes: 2000000,
  maxWindowMs: 10 * 86400000,
  maxTimeMs: 10000,
  maxConcurrency: 2,
  maxCost: 10000,
};
export const seoQuality: MetricReadQuality = {
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  freshness: "fresh",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
/** No credentials, database or production traffic. Replace only the source/authority/store with host implementations. */
export function createSeoFixture() {
  let input = seoFixtureInput();
  // A third actual normalized frame lets period selection change the source rows, not their labels.
  const prior = seoFixtureInput().baseline;
  prior.search.metadata.window = { from: "2026-09-30T07:00:00Z", to: "2026-10-01T07:00:00Z" };
  prior.search.rows = prior.search.rows.map((row, index) =>
    index === 0 ? { ...row, impressions: 50, clicks: 30, position: 2.75 } : row,
  );
  if (prior.landing) {
    prior.landing.metadata.window = { ...prior.search.metadata.window };
    prior.landing.rows = prior.landing.rows.map((row, index) =>
      index === 0 ? { ...row, sessions: 29, outcomes: 9, lcpP75: 1100 } : row,
    );
  }

  let access: Pick<SeoAccess, "scope" | "permissions"> = {
    scope: seoScope,
    permissions: ["seo.read", "seo.report", "seo.export", "seo.delete"],
  };
  const records = new Map<string, SeoSavedReport>();
  let failure = false;
  const key = (scope: typeof seoScope, id: string) =>
    JSON.stringify([scope.app, scope.environment, scope.tenant, id]);
  const metricGrant = (action: MetricReadAction) =>
    access.permissions.includes("seo.read") &&
    action.requiredFields.every((field) => ["seo.pages", "seo.sources"].includes(field))
      ? { permissionEpoch: "p1", privacyEpoch: "v1" }
      : null;
  const operations = createSeoWorkbench({
    authenticate: async (action) => ({
      ...structuredClone(access),
      metricGrant: action ? metricGrant(action) : null,
    }),
    now: () => new Date("2026-10-20T00:00:00Z"),
    mask: (field, value) =>
      field === "pageId"
        ? value
        : field === "sourceRef"
          ? value.replace(/https?:[^ ]+/g, "[source]")
          : value,
    async reader(scope, definition) {
      const revisions = [
        { sourceRef: "search", revision: "snapshot-v1" },
        { sourceRef: "events", revision: "snapshot-v1" },
      ];
      const registration = await registerSeoQuery({
        queryId: "seo-comparison",
        queryVersion: 1,
        scope,
        definition,
        sourceRevisions: revisions,
        limits: seoLimits,
        requiredFields: ["seo.pages", "seo.sources"],
        source: async () => {
          if (failure) throw new SeoComparisonProblem("synthetic-provider-failure");
          const sameWindow = (
            left: { from: string; to: string },
            right: { from: string; to: string },
          ) =>
            Date.parse(left.from) === Date.parse(right.from) &&
            Date.parse(left.to) === Date.parse(right.to);
          const frames = [input.baseline, input.current, prior];
          const baseline = frames.find((frame) =>
            sameWindow(frame.search.metadata.window, definition.baselineWindow),
          );
          const current = frames.find((frame) =>
            sameWindow(frame.search.metadata.window, definition.currentWindow),
          );
          const unavailable = (
            window: typeof definition.baselineWindow,
          ): typeof input.baseline => ({
            search: {
              metadata: {
                ...input.baseline.search.metadata,
                window,
                completeness: "partial",
                coverage: "returned-rows",
                state: "unavailable",
              },
              rows: [],
            },
            ...(input.baseline.landing
              ? {
                  landing: {
                    metadata: {
                      ...input.baseline.landing.metadata,
                      window,
                      completeness: "partial",
                      coverage: "returned-rows",
                      state: "unavailable",
                    },
                    rows: [],
                  },
                }
              : {}),
          });
          return {
            input: structuredClone({
              ...input,
              definition,
              baseline: baseline ?? unavailable(definition.baselineWindow),
              current: current ?? unavailable(definition.currentWindow),
            }),
            quality: seoQuality,
          };
        },
      });
      const service = new MetricReadService([registration.definition], [registration.query], {
        currentContext: () => ({
          principal: { ...access.scope, subject: "synthetic-operator" },
          allowedFields: ["seo.pages", "seo.sources"],
          allowRaw: false,
          budget: seoLimits,
          sourceRevisions: revisions,
          snapshotRefs: ["search-snapshot", "event-snapshot"],
        }),
        authorize: async (_context, action) => metricGrant(action),
      });
      return {
        service,
        queryId: registration.query.id,
        window: {
          from: new Date(definition.baselineWindow.from).toISOString(),
          to: new Date(definition.currentWindow.to).toISOString(),
        },
      };
    },
    store: {
      write: async (scope, record) => {
        records.set(key(scope, record.id), structuredClone(record));
      },
      read: async (scope, id) => records.get(key(scope, id)),
      delete: async (scope, id) => {
        records.delete(key(scope, id));
      },
    },
  });
  return {
    operations,
    setInput: (next: SeoComparisonInput) => {
      input = next;
    },
    setAccess: (next: Pick<SeoAccess, "scope" | "permissions">) => {
      access = next;
    },
    setFailure: (next: boolean) => {
      failure = next;
    },
    records,
    compare: () => compareSeo(input),
  };
}
