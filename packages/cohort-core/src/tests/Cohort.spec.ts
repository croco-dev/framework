import { describe, expect, it } from "vitest";
import {
  CohortAudienceSource,
  CohortInvalidProblem,
  CohortUnavailableProblem,
  PublishedCohortReader,
  cohortContentHash,
  evaluateCohort,
  previewCohort,
  validateCohort,
} from "../index";
import type {
  CohortDefinition,
  CohortPredicate,
  CohortPublication,
  CohortRegistration,
  CohortSubject,
} from "../index";
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const asOf = "2026-09-27T00:00:00Z";
const registration: CohortRegistration = {
  fields: { plan: { type: "string", operators: ["eq"], values: ["trial", "paid"] } },
  events: ["report.created"],
  memberships: [],
};
const context = { scope, subjectKind: "user", allowedFields: ["plan"] };
const definition: CohortDefinition = {
  id: "trial",
  version: 1,
  subjectKind: "user",
  scope,
  root: {
    kind: "all",
    children: [
      { kind: "fact", field: "plan", operator: "eq", value: "trial" },
      {
        kind: "event",
        event: "report.created",
        metric: "count",
        operator: "eq",
        value: 0,
        windowDays: 7,
      },
    ],
  },
};
const base: CohortSubject = {
  subjectId: "quiet",
  facts: { plan: "trial" },
  events: [],
  coverage: [{ event: "report.created", from: "2026-09-20T00:00:00Z", to: asOf }],
  memberships: [],
};
const subjects = [
  base,
  {
    ...base,
    subjectId: "active",
    events: [{ event: "report.created", occurredAt: "2026-09-25T00:00:00Z" }],
  },
  { ...base, subjectId: "unobserved", coverage: [] },
];
function publication(): CohortPublication {
  return {
    withdrawn: false,
    subjectIds: ["quiet"],
    snapshot: {
      snapshotId: "snap",
      scope,
      subjectKind: "user",
      definitionId: "trial",
      definitionVersion: 1,
      schemaVersion: 1,
      sourceSnapshotRefs: ["source"],
      asOf,
      generatedAt: asOf,
      validUntil: "2026-09-28T00:00:00Z",
      contentHash: cohortContentHash(["quiet"]),
      publicationRevision: 1,
      privacyVersion: "v1",
      membershipRef: "run",
    },
  };
}
describe("cohort evaluator", () => {
  it("distinguishes observed action, complete inactivity and missing coverage", () => {
    expect(previewCohort(definition, registration, context, subjects, asOf)).toMatchObject({
      total: 3,
      match: 1,
      noMatch: 1,
      unknown: 1,
    });
    const inverted = { ...definition, root: { kind: "not" as const, child: definition.root } };
    expect(subjects.map((subject) => evaluateCohort(inverted, subject, asOf).result)).toEqual([
      "no_match",
      "match",
      "unknown",
    ]);
  });
  it("returns deterministic bounded explanations without fact values", () => {
    const forward = previewCohort(definition, registration, context, subjects, asOf, 2);
    expect(
      previewCohort(definition, registration, context, [...subjects].reverse(), asOf, 2),
    ).toEqual(forward);
    expect(forward.sample).toHaveLength(2);
    expect(JSON.stringify(forward.sample)).not.toContain("trial");
  });
  it("rejects field/type/operator, tenant and budget violations", () => {
    expect(() =>
      validateCohort(definition, registration, { ...context, allowedFields: [] }),
    ).toThrow(CohortInvalidProblem);
    expect(() =>
      validateCohort(definition, registration, { ...context, scope: { ...scope, tenantId: "" } }),
    ).toThrow();
    expect(() =>
      validateCohort(
        { ...definition, root: { kind: "fact", field: "plan", operator: "gt", value: 1 } },
        registration,
        context,
      ),
    ).toThrow();
    expect(() =>
      previewCohort(definition, registration, { ...context, limits: { cost: 1 } }, subjects, asOf),
    ).toThrow();
    expect(() => previewCohort(definition, registration, context, [base, base], asOf)).toThrow();
  });
  it.each([
    { limit: 4, limits: {} },
    { limit: 2, limits: { nesting: 2 } },
    { limit: 6, limits: { nesting: 6 } },
  ])("enforces nesting limit $limit at its boundary", ({ limit, limits }) => {
    let root: CohortPredicate = { kind: "fact", field: "plan", operator: "eq", value: "trial" };
    for (let depth = 1; depth < limit; depth++) root = { kind: "not", child: root };
    const validation = { ...context, limits };
    expect(() => validateCohort({ ...definition, root }, registration, validation)).not.toThrow();
    expect(() =>
      validateCohort(
        { ...definition, root: { kind: "not", child: root } },
        registration,
        validation,
      ),
    ).toThrow(CohortInvalidProblem);
  });
  it.each([
    { limit: 30, limits: {} },
    { limit: 3, limits: { predicates: 3 } },
    { limit: 40, limits: { predicates: 40 } },
  ])("enforces predicate count limit $limit at its boundary", ({ limit, limits }) => {
    const leaf: CohortPredicate = { kind: "fact", field: "plan", operator: "eq", value: "trial" };
    const children = Array.from({ length: limit - 1 }, () => leaf);
    const validation = { ...context, limits };
    expect(() =>
      validateCohort({ ...definition, root: { kind: "all", children } }, registration, validation),
    ).not.toThrow();
    expect(() =>
      validateCohort(
        { ...definition, root: { kind: "all", children: [...children, leaf] } },
        registration,
        validation,
      ),
    ).toThrow(CohortInvalidProblem);
  });
  it("uses UTC calendar days and joins continuous coverage intervals", () => {
    const daily: CohortDefinition = {
      ...definition,
      root: {
        kind: "event",
        event: "report.created",
        metric: "distinct-calendar-days",
        operator: "eq",
        value: 1,
        windowDays: 7,
      },
    };
    const subject = {
      ...base,
      events: [
        { event: "report.created", occurredAt: "2026-09-25T01:00:00Z" },
        { event: "report.created", occurredAt: "2026-09-25T23:00:00Z" },
      ],
      coverage: [
        { event: "report.created", from: "2026-09-20T00:00:00Z", to: "2026-09-23T00:00:00Z" },
        { event: "report.created", from: "2026-09-23T00:00:00Z", to: asOf },
      ],
    };
    expect(evaluateCohort(daily, subject, asOf).result).toBe("match");
  });
});
describe("published audience", () => {
  it("serves a pinned snapshot with metadata independent of source availability", async () => {
    const reader = new PublishedCohortReader(
      { read: async () => publication() },
      { currentVersion: async () => "v1", isAllowed: async () => true },
    );
    const audience = new CohortAudienceSource(reader, "snap", scope, "user", () => new Date(asOf));
    const members = [];
    for await (const member of audience.members({ tenantId: "tenant" })) members.push(member);
    expect(members).toMatchObject([
      {
        subjectId: "quiet",
        cohortSnapshot: { snapshotId: "snap", sourceSnapshotRefs: ["source"] },
      },
    ]);
    expect(await audience.estimate({ tenantId: "tenant" })).toBe(1);
    await expect(audience.estimate({})).rejects.toThrow(CohortUnavailableProblem);
  });
  it.each(["expired", "withdrawn", "schema", "hash", "privacy", "timestamp"] as const)(
    "rejects %s as unavailable",
    async (mode) => {
      const original = publication();
      const value = {
        ...original,
        withdrawn: mode === "withdrawn",
        snapshot: {
          ...original.snapshot,
          ...(mode === "expired" ? { validUntil: asOf } : {}),
          ...(mode === "timestamp" ? { validUntil: "invalid" } : {}),
          ...(mode === "schema" ? { schemaVersion: 2 as 1 } : {}),
          ...(mode === "hash" ? { contentHash: "bad" } : {}),
        },
      };
      const reader = new PublishedCohortReader(
        { read: async () => value },
        {
          currentVersion: async () => (mode === "privacy" ? "v2" : "v1"),
          isAllowed: async () => true,
        },
      );
      await expect(reader.read("snap", scope, "user", new Date(asOf))).rejects.toThrow(
        CohortUnavailableProblem,
      );
    },
  );
  it("does not revive suppressed subjects and fails privacy provider outages", async () => {
    const reader = new PublishedCohortReader(
      { read: async () => publication() },
      { currentVersion: async () => "v1", isAllowed: async () => false },
    );
    expect((await reader.read("snap", scope, "user", new Date(asOf))).subjectIds).toEqual([]);
    const failed = new PublishedCohortReader(
      { read: async () => publication() },
      {
        currentVersion: async () => {
          throw new CohortUnavailableProblem("offline");
        },
        isAllowed: async () => true,
      },
    );
    await expect(failed.read("snap", scope, "user", new Date(asOf))).rejects.toThrow("offline");
  });
});
