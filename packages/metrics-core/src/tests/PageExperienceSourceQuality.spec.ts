import { describe, expect, it } from "vitest";
import { registerPageExperienceQuery, PAGE_EXPERIENCE_FIELDS } from "../libs/PageExperienceSources";
import { MetricReadService } from "../libs/read/MetricReadService";
import type { MetricReadQuality } from "../libs/read/MetricReadService";
import { fixture } from "../../../../examples/page-experience/src/fixture";

const exact: MetricReadQuality = {
  temporalCompleteness: "complete",
  populationCoverage: "complete",
  freshness: "fresh",
  validity: "valid",
  exactness: "exact",
  reproducibility: "reproducible",
};
const cases: { label: string; quality: MetricReadQuality }[] = [
  { label: "invalid", quality: { ...exact, validity: "invalid" } },
  { label: "approximate", quality: { ...exact, exactness: "approximate" } },
  { label: "unverified", quality: { ...exact, reproducibility: "unverified" } },
];

describe("Page experience source quality", () => {
  it.each(cases)(
    "withholds $label source evidence instead of displaying definitive rates",
    async ({ quality }) => {
      const { rows, ...metadata } = structuredClone(fixture);
      const limits = {
        maxRows: 100,
        maxBytes: 100000,
        maxTimeMs: 30000,
        maxWindowMs: 86400000,
        maxConcurrency: 1,
        maxCost: 100,
      };
      const registration = await registerPageExperienceQuery({
        id: "page-quality",
        version: 1,
        metadata,
        limits,
        load: async () => ({ rows, quality }),
      });
      const service = new MetricReadService([registration.definition], [registration.query], {
        currentContext: () => ({
          principal: { ...metadata.scope, subject: "operator" },
          allowedFields: PAGE_EXPERIENCE_FIELDS,
          allowRaw: false,
          budget: limits,
          sourceRevisions: [{ sourceRef: metadata.sourceRef, revision: metadata.sourceRevision }],
          snapshotRefs: [metadata.snapshotRef],
        }),
        authorize: async () => ({ permissionEpoch: "1", privacyEpoch: "1" }),
      });
      await expect(
        service.runRegisteredQuery("page-quality", null, metadata.window),
      ).rejects.toMatchObject({
        code: "metrics/page-experience/invalid",
        field: "query-source-quality",
      });
    },
  );
});
