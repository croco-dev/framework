import { describe, expect, it } from "vitest";
import {
  calculatePageExperience,
  importGa4Engagement,
  PageExperienceProblem,
} from "../libs/PageExperience";
import type { PageExperienceInput, PageExperienceRow } from "../libs/PageExperience";
import {
  importPageExperienceSource,
  PAGE_EXPERIENCE_FIELDS,
  registerPageExperienceQuery,
} from "../libs/PageExperienceSources";
import { MetricReadService } from "../libs/read/MetricReadService";
const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString();
function row(
  kind: PageExperienceRow["kind"],
  session: string,
  seconds: number,
  value: string = kind,
): PageExperienceRow {
  return {
    id: `${session}-${kind}-${seconds}`,
    source: kind === "committed" ? "billing" : "browser",
    session,
    subject: session,
    pageInstance: `p-${session}`,
    page: "product",
    kind,
    occurredAt: at(seconds),
    receivedAt: at(seconds),
    value,
  };
}
function fixture(): PageExperienceInput {
  return {
    scope: { app: "shop", environment: "test", tenant: "tenant" },
    definition: {
      id: "product",
      version: 1,
      page: "product",
      contentCondition: "hero-visible",
      contentMinIntersectionRatio: 0.5,
      minVisibleMs: 10000,
      engagementActions: ["preview"],
      valueAction: "purchase",
      unit: "session",
      sessionWindowMs: 60000,
      timezone: "Asia/Seoul",
      hiddenTime: "exclude",
    },
    sourceRef: "page-history",
    sourceRevision: "r1",
    snapshotRef: "s1",
    window: { from: at(0), to: at(30) },
    cutoff: at(120),
    allowedLatenessMs: 10000,
    completeThrough: at(120),
    coverage: "complete",
    deletedSubjects: [],
    rows: [
      row("session", "one", 0),
      row("view", "one", 1, "product"),
      row("content", "one", 2, "hero-visible"),
      row("action", "one", 3, "preview"),
      row("attempt", "one", 4, "purchase"),
      row("committed", "one", 5, "purchase"),
      row("session", "two", 10),
      row("view", "two", 11, "product"),
      row("session", "three", 20),
      row("view", "three", 21, "product"),
      row("content", "three", 22, "hero-visible"),
      row("visible", "three", 33, "10000"),
    ],
  };
}
describe("Page experience", () => {
  it.each([undefined, null, ""])(
    "rejects an absent or empty reporting timezone (%s)",
    async (timezone) => {
      const input = fixture();
      Object.assign(input.definition, { timezone });
      await expect(calculatePageExperience(input)).rejects.toMatchObject({ field: "timezone" });
    },
  );
  it("counts only the defined page's confirmed outcomes, including outcomes with missing UI", async () => {
    const input = fixture();
    const otherPage = {
      ...row("committed", "one", 6, "purchase"),
      id: "other-page-receipt",
      page: "other",
      pageInstance: "other-instance",
    };
    const missingUi = { ...row("committed", "missing", 7, "purchase"), id: "missing-ui-receipt" };
    const result = await calculatePageExperience({
      ...input,
      rows: [...input.rows, otherPage, missingUi],
    });
    expect(result.confirmedOutcomes).toBe(2);
    expect(result.unlinkedCommitted).toBe(1);
    expect(result.committed.numerator).toBe(1);
  });
  it("uses one cohort with a single-page engagement, an actual bounce and a timed engagement", async () => {
    const result = await calculatePageExperience(fixture());
    expect(result.viewed).toBe(3);
    expect(result.engaged).toEqual({ unobserved: 0, numerator: 2, denominator: 3, value: 2 / 3 });
    expect(result.attempted.numerator).toBe(1);
    expect(result.committed.numerator).toBe(1);
    expect(result.bounce).toEqual({ unobserved: 0, numerator: 1, denominator: 3, value: 1 / 3 });
  });
  it("deduplicates identical receipt replay and never turns rollback/attempt alone into success", async () => {
    const data = fixture();
    const receipt = data.rows.find((r) => r.kind === "committed");
    expect(receipt).toBeDefined();
    const replay = await calculatePageExperience({
      ...data,
      rows: [...data.rows, ...(receipt ? [receipt] : [])],
    });
    expect(replay.committed.numerator).toBe(1);
    const rollback = await calculatePageExperience({
      ...data,
      rows: data.rows.filter((r) => r.kind !== "committed"),
    });
    expect(rollback.committed.numerator).toBe(0);
  });
  it("does not count pre-content visibility or an out-of-order attempt in the ordered funnel", async () => {
    const data = fixture();
    data.rows = [
      row("session", "one", 0),
      row("view", "one", 1, "product"),
      row("visible", "one", 2, "20000"),
      row("attempt", "one", 3, "purchase"),
      row("content", "one", 4, "hero-visible"),
      row("action", "one", 5, "preview"),
      row("committed", "one", 6, "purchase"),
    ];
    const result = await calculatePageExperience(data);
    expect(result.engaged.numerator).toBe(1);
    expect(result.attempted.numerator).toBe(0);
    expect(result.committed.numerator).toBe(0);
    expect(result.bounce.numerator).toBe(0);
  });
  it("keeps open and gap sessions unknown instead of assigning bounce", async () => {
    const data = fixture();
    data.cutoff = at(75);
    data.completeThrough = at(75);
    const result = await calculatePageExperience(data);
    expect(result.completeSessions).toBe(1);
    expect(result.openSessions).toBe(2);
    expect(result.bounce).toEqual({ unobserved: 1, numerator: 0, denominator: 3, value: null });
    const gap = await calculatePageExperience({ ...fixture(), coverage: "partial" });
    expect(gap.unknownSessions).toBe(3);
    expect(gap.bounce.denominator).toBe(3);
    expect(gap.bounce.unobserved).toBe(1);
    expect(gap.bounce.value).toBeNull();
    const noCoverage = await calculatePageExperience({ ...fixture(), completeThrough: null });
    expect(noCoverage.unknownSessions).toBe(3);
  });
  it("distinguishes zero denominator and no observations", async () => {
    const result = await calculatePageExperience({ ...fixture(), rows: [] });
    expect(result.bounce.value).toBeNull();
    expect(result.engaged.value).toBeNull();
  });
  it("counts independent receipts without inventing a browser failure or funnel conversion", async () => {
    const data = fixture();
    data.rows = [row("committed", "missing", 5, "purchase")];
    const result = await calculatePageExperience(data);
    expect(result.unlinkedCommitted).toBe(1);
    expect(result.viewed).toBe(0);
    expect(result.committed.value).toBeNull();
  });
  it("uses [from,to) for session cohort and distinct units after per-instance order", async () => {
    const data = fixture();
    data.rows = [
      ...data.rows,
      row("session", "boundary", 30),
      row("view", "boundary", 31, "product"),
    ];
    expect((await calculatePageExperience(data)).viewed).toBe(3);
    data.rows = data.rows.map((r) => ({ ...r, subject: "shared" }));
    data.definition.unit = "subject";
    const result = await calculatePageExperience(data);
    expect(result.viewed).toBe(1);
    expect(result.bounce.numerator).toBe(0);
  });
  it.each([
    ["session", 2, 2],
    ["subject", 1, 1],
    ["pageInstance", 3, 3],
  ] as const)(
    "keeps instance ordering before counting distinct %s units",
    async (unit, viewed, engaged) => {
      const data = fixture();
      data.definition.unit = unit;
      data.rows = [
        row("session", "one", 0),
        row("view", "one", 1, "product"),
        row("content", "one", 2, "hero-visible"),
        row("action", "one", 3, "preview"),
        { ...row("view", "one", 4, "product"), pageInstance: "second" },
        { ...row("attempt", "one", 5, "purchase"), pageInstance: "second" },
        { ...row("committed", "one", 6, "purchase"), pageInstance: "second" },
        row("session", "two", 10),
        row("view", "two", 11, "product"),
        row("content", "two", 12, "hero-visible"),
        row("action", "two", 13, "preview"),
        row("attempt", "two", 14, "purchase"),
        row("committed", "two", 15, "purchase"),
      ].map((event) => ({ ...event, subject: "shared" }));
      const result = await calculatePageExperience(data);
      expect(result.viewed).toBe(viewed);
      expect(result.engaged.numerator).toBe(engaged);
      expect(result.attempted.numerator).toBe(1);
      expect(result.committed.numerator).toBe(1);
      expect(result.confirmedOutcomes).toBe(2);
      expect(result.unlinkedCommitted).toBe(1);
      expect(result.bounce.numerator).toBe(0);
    },
  );
  it("accepts repeated events while rejecting a different page in one instance", async () => {
    const data = fixture();
    const events = [row("session", "one", 0), row("view", "one", 1, "product")];
    for (let i = 0; i < 10000; i++) {
      const event = row("action", "one", 2, "preview");
      event.id = `repeat-${i}`;
      events.push(event);
    }
    data.rows = events;
    expect((await calculatePageExperience(data)).viewed).toBe(1);
    data.rows = [...events, { ...row("action", "one", 3, "preview"), page: "different" }];
    await expect(calculatePageExperience(data)).rejects.toMatchObject({ field: "instance-page" });
  });
  it("revises cutoff identity for late arrivals and excludes arrivals beyond allowed lateness", async () => {
    const data = fixture();
    data.rows = data.rows.map((r) => (r.kind === "committed" ? { ...r, receivedAt: at(15) } : r));
    expect((await calculatePageExperience(data)).committed.numerator).toBe(1);
    const late = await calculatePageExperience({
      ...data,
      rows: data.rows.map((r) => (r.kind === "committed" ? { ...r, receivedAt: at(16) } : r)),
    });
    expect(late.committed.numerator).toBe(0);
    expect(late.lateRows).toBe(1);
    expect(late.revision).not.toBe((await calculatePageExperience(data)).revision);
  });
  it("rejects conflicting identities, invalid instants and missing tenants; deletes subjects", async () => {
    const data = fixture();
    const first = data.rows[0];
    expect(first).toBeDefined();
    if (first)
      await expect(
        calculatePageExperience({ ...data, rows: [...data.rows, { ...first, value: "conflict" }] }),
      ).rejects.toBeInstanceOf(PageExperienceProblem);
    await expect(
      calculatePageExperience({ ...data, cutoff: "2026-02-30T00:00:00.000Z" }),
    ).rejects.toBeInstanceOf(PageExperienceProblem);
    await expect(
      calculatePageExperience({
        ...data,
        scope: { app: "shop", environment: "test" } as PageExperienceInput["scope"],
      }),
    ).rejects.toBeInstanceOf(PageExperienceProblem);
    expect(
      (await calculatePageExperience({ ...data, deletedSubjects: ["one"] })).committed.numerator,
    ).toBe(0);
  });
  it("imports bounded JSONL with the shared parser and exactly matches standalone results", async () => {
    const data = fixture();
    async function* bytes() {
      yield new TextEncoder().encode(data.rows.map((r) => JSON.stringify(r)).join("\n"));
    }
    const rows = await importPageExperienceSource(
      bytes(),
      {
        format: "jsonl",
        encoding: "utf-8",
        fields: PAGE_EXPERIENCE_FIELDS.map((name) => ({ name, type: "string" })),
        limits: { maxBytes: 100000, maxRecords: 100, maxRowBytes: 2048 },
      },
      100,
    );
    expect(await calculatePageExperience({ ...data, rows })).toEqual(
      await calculatePageExperience(data),
    );
    await expect(
      importPageExperienceSource(
        bytes(),
        {
          format: "jsonl",
          encoding: "utf-8",
          fields: PAGE_EXPERIENCE_FIELDS.map((name) => ({ name, type: "string" })),
          limits: { maxBytes: 100000, maxRecords: 100, maxRowBytes: 2048 },
        },
        2,
      ),
    ).rejects.toBeInstanceOf(PageExperienceProblem);
  });
  it("preserves GA4 original denominator and version instead of applying a custom threshold", () => {
    const result = importGa4Engagement({
      provider: "ga4",
      definitionVersion: "ga4-v1",
      settingsVersion: "settings-7",
      sourceRevision: "ga4-source",
      sessionDenominator: 10,
      engagedSessions: 7,
      window: { from: at(0), to: at(30) },
      timezone: "UTC",
      filters: "public-only",
    });
    expect(result.bounce).toEqual({ unobserved: 0, numerator: 3, denominator: 10, value: 0.3 });
    expect(result.settingsVersion).toBe("settings-7");
    const missingTimezone = { ...result };
    Reflect.deleteProperty(missingTimezone, "timezone");
    expect(() => importGa4Engagement(missingTimezone)).toThrow(PageExperienceProblem);
    expect(
      importGa4Engagement({ ...result, sessionDenominator: 0, engagedSessions: 0 }).bounce.value,
    ).toBeNull();
  });
  it("runs the registered query under current authority and refuses cross-tenant and revoked reads", async () => {
    const input = fixture();
    const { rows, ...metadata } = input;
    const limits = {
      maxRows: 100,
      maxBytes: 100000,
      maxTimeMs: 30000,
      maxWindowMs: 86400000,
      maxConcurrency: 1,
      maxCost: 100,
    };
    const quality = {
      temporalCompleteness: "complete",
      freshness: "fresh",
      populationCoverage: "complete",
      validity: "valid",
      exactness: "exact",
      reproducibility: "reproducible",
    } as const;
    const registration = await registerPageExperienceQuery({
      id: "page-query",
      version: 1,
      metadata,
      limits,
      load: async () => ({ rows, quality }),
    });
    let tenant = input.scope.tenant,
      permitted = true;
    const service = new MetricReadService([registration.definition], [registration.query], {
      currentContext: () => ({
        principal: { ...input.scope, tenant, subject: "operator" },
        allowedFields: PAGE_EXPERIENCE_FIELDS,
        allowRaw: false,
        budget: limits,
        sourceRevisions: [{ sourceRef: input.sourceRef, revision: input.sourceRevision }],
        snapshotRefs: [input.snapshotRef],
      }),
      authorize: async () => (permitted ? { permissionEpoch: "1", privacyEpoch: "1" } : null),
    });
    const result = await service.runRegisteredQuery("page-query", null, input.window);
    expect(result.status).toBe("verified");
    if (result.status === "verified")
      expect(result.result.data).toEqual(await calculatePageExperience(input));
    tenant = "other";
    await expect(
      service.runRegisteredQuery("page-query", null, input.window),
    ).rejects.toBeInstanceOf(PageExperienceProblem);
    tenant = input.scope.tenant;
    permitted = false;
    expect((await service.runRegisteredQuery("page-query", null, input.window)).status).toBe(
      "denied",
    );
  });
});
