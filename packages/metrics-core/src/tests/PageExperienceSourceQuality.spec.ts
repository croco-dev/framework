import { describe, expect, it } from "vitest";
import { registerPageExperienceQuery, PAGE_EXPERIENCE_FIELDS } from "../libs/PageExperienceSources";
import { MetricReadService } from "../libs/read/MetricReadService";
import type { PageExperienceInput } from "../libs/PageExperience";
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

const emptyCases: {
  label: string;
  coverage: PageExperienceInput["coverage"];
  through: string | null;
  status: "partial" | "verified";
  temporal?: MetricReadQuality["temporalCompleteness"];
}[] = [
  {
    label: "partial coverage",
    coverage: "partial",
    through: fixture.completeThrough,
    status: "partial",
  },
  {
    label: "unknown coverage",
    coverage: "unknown",
    through: fixture.completeThrough,
    status: "partial",
  },
  { label: "missing watermark", coverage: "complete", through: null, status: "partial" },
  {
    label: "short watermark",
    coverage: "complete",
    through: fixture.window.from,
    status: "partial",
  },
  {
    label: "complete through window end",
    coverage: "complete",
    through: fixture.window.to,
    status: "verified",
  },
  {
    label: "complete after window end",
    coverage: "complete",
    through: fixture.completeThrough,
    status: "verified",
  },
  {
    label: "partial source",
    coverage: "complete",
    through: fixture.completeThrough,
    status: "partial",
    temporal: "partial",
  },
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
  it.each(
    emptyCases.flatMap((item) =>
      ["empty", "outside"].map((population) => ({ ...item, population })),
    ),
  )(
    "reports $status for $population cohorts with $label",
    async ({ coverage, through, status, population, temporal = "complete" }) => {
      const { rows: originalRows, ...metadata } = structuredClone(fixture);
      metadata.coverage = coverage;
      metadata.completeThrough = through;
      const outside = originalRows
        .filter((r) => r.kind === "session")
        .map((r) => ({
          ...r,
          occurredAt: new Date(
            Date.parse(metadata.window.from) - metadata.definition.sessionWindowMs,
          ).toISOString(),
          receivedAt: new Date(
            Date.parse(metadata.window.from) - metadata.definition.sessionWindowMs,
          ).toISOString(),
        }));
      const rows = population === "empty" ? [] : outside;
      const limits = {
        maxRows: 100,
        maxBytes: 100000,
        maxTimeMs: 30000,
        maxWindowMs: 86400000,
        maxConcurrency: 1,
        maxCost: 100,
      };
      const registration = await registerPageExperienceQuery({
        id: "empty-quality",
        version: 1,
        metadata,
        limits,
        load: async () => ({ rows, quality: { ...exact, temporalCompleteness: temporal } }),
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
      const result = await service.runRegisteredQuery("empty-quality", null, metadata.window);
      expect(result.status).toBe(status);
      if (result.status !== "verified" && result.status !== "partial") return;
      expect(result.result?.quality.temporalCompleteness).toBe(
        status === "verified" ? "complete" : "partial",
      );
      expect(result.result?.data).toMatchObject({
        viewed: 0,
        completeSessions: 0,
        openSessions: 0,
        unknownSessions: 0,
        orphanRows: 0,
        invalidInstances: 0,
        coverage: temporal === "partial" ? "partial" : coverage,
        bounce: { value: null, denominator: 0 },
      });
    },
  );
});
