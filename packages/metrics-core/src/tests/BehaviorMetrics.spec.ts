import { describe, expect, it } from "vitest";
import {
  computePeriodicRetention,
  computeCohortRetention,
  computeFrequencyDistribution,
  ConflictingBehaviorEventProblem,
  InvalidBehaviorMetricProblem,
} from "../libs/BehaviorMetrics";
import type {
  BehaviorDefinition,
  BehaviorDataset,
  BehaviorObservation,
  BehaviorRetentionOptions,
} from "../libs/BehaviorMetrics";

const scope = { appId: "reports", environment: "test", tenantId: "tenant-a" };
const definition: BehaviorDefinition = {
  id: "saved",
  version: "1",
  subjectKind: "user",
  timezone: "UTC",
  actions: ["report.saved"],
  deletedSubjectPolicy: "include",
  historyStart: "2024-01-01T00:00:00Z",
};
const options: BehaviorRetentionOptions = {
  baseline: { kind: "calendar", from: "2024-02-19T00:00:00Z", to: "2024-02-26T00:00:00Z" },
  returning: { kind: "calendar", from: "2024-02-26T00:00:00Z", to: "2024-03-04T00:00:00Z" },
};
function event(
  subjectId: string,
  occurredAt: string,
  eventId = `${subjectId}-${occurredAt}`,
): BehaviorObservation {
  return { subjectId, occurredAt, eventId, source: "reports", action: "report.saved", scope };
}
function dataset(events: BehaviorObservation[]): BehaviorDataset {
  return {
    definitionId: "saved",
    version: "1",
    subjectKind: "user",
    timezone: "UTC",
    scope,
    events,
    knownHistoryFrom: definition.historyStart,
    completeThrough: "2024-03-04T00:00:00Z",
  };
}
describe("normalized behavior metrics", () => {
  it("retains 40 of 100 baseline subjects independently of 80 new subjects", () => {
    const baseline = Array.from({ length: 100 }, (_, i) =>
      event(`old-${i}`, "2024-02-20T10:00:00Z"),
    );
    const returning = Array.from({ length: 40 }, (_, i) =>
      event(`old-${i}`, "2024-02-27T10:00:00Z"),
    );
    const newcomers = Array.from({ length: 80 }, (_, i) =>
      event(`new-${i}`, "2024-02-27T10:00:00Z"),
    );
    for (const events of [
      [...baseline, ...returning],
      [...baseline, ...returning, ...newcomers],
    ]) {
      const result = computePeriodicRetention(definition, dataset(events), options);
      expect(result).toMatchObject({
        numerator: 40,
        denominator: 100,
        value: 0.4,
        availability: "complete",
      });
      expect(result.subjects.filter((subject) => subject.inDenominator)).toHaveLength(100);
    }
  });
  it("uses null for zero denominator and unfinished or unknown observations", () => {
    expect(computePeriodicRetention(definition, dataset([]), options)).toMatchObject({
      value: null,
      reason: "zero-denominator",
    });
    const input = dataset([event("a", "2024-02-20T10:00:00Z")]);
    expect(
      computePeriodicRetention(
        definition,
        { ...input, completeThrough: "2024-03-03T23:59:59Z" },
        options,
      ),
    ).toMatchObject({ value: null, availability: "provisional" });
    expect(
      computePeriodicRetention(definition, { ...input, completeThrough: undefined }, options),
    ).toMatchObject({ value: null, availability: "provisional" });
    expect(
      computeCohortRetention(
        definition,
        { ...input, knownHistoryFrom: "2024-02-19T00:00:00Z" },
        options,
      ),
    ).toMatchObject({
      value: null,
      denominator: 0,
      availability: "insufficient",
      reason: "unknown-history",
    });
  });
  it("separates lifetime first-use cohorts from periodic activity", () => {
    const input = dataset([
      event("a", "2024-01-10T10:00:00Z"),
      event("a", "2024-02-20T10:00:00Z"),
      event("a", "2024-02-27T10:00:00Z"),
      event("b", "2024-02-20T10:00:00Z"),
    ]);
    expect(computePeriodicRetention(definition, input, options)).toMatchObject({
      numerator: 1,
      denominator: 2,
      value: 0.5,
    });
    const cohort = computeCohortRetention(definition, input, options);
    expect(cohort).toMatchObject({ numerator: 0, denominator: 1, value: 0 });
    expect(cohort.subjects[0]).toMatchObject({
      subjectId: "a",
      reason: "earlier-activity",
      inDenominator: false,
    });
  });
  it("counts three distinct actions on one leap day while deduplicating retransmission", () => {
    const first = event("a", "2024-02-29T12:00:00Z", "1");
    const input = dataset([
      first,
      { ...first },
      { ...first, eventId: "2" },
      { ...first, eventId: "3" },
      { ...first, eventId: "open", action: "app.open" },
    ]);
    const count = computeFrequencyDistribution(definition, input, {
      window: options.returning,
      measure: "count",
    });
    expect(count.buckets).toEqual([{ frequency: 3, numerator: 1, denominator: 1, value: 1 }]);
    expect(count.subjects[0]).toMatchObject({ count: 3, activeDays: 1 });
    expect(count.sourceRefs).toHaveLength(3);
    expect(
      computeFrequencyDistribution(definition, input, {
        window: options.returning,
        measure: "activeDays",
      }).buckets[0].frequency,
    ).toBe(1);
    expect(() =>
      computePeriodicRetention(definition, dataset([first, { ...first, subjectId: "b" }]), options),
    ).toThrow(ConflictingBehaviorEventProblem);
  });
  it("deduplicates only within a source and validates identities even for ignored actions", () => {
    const first = event("a", "2024-02-29T12:00:00Z", "1");
    const input = dataset([
      first,
      { ...first, occurredAt: "2024-02-29T21:00:00+09:00" },
      { ...first, source: "import" },
    ]);
    expect(
      computeFrequencyDistribution(definition, input, {
        window: options.returning,
        measure: "count",
      }).subjects[0].count,
    ).toBe(2);
    expect(() =>
      computePeriodicRetention(
        definition,
        dataset([{ ...first, action: "app.open" }, first]),
        options,
      ),
    ).toThrow(ConflictingBehaviorEventProblem);
    for (const occurredAt of ["2024-02-29T24:00:00Z", "2024-13-01T00:00:00Z"]) {
      expect(() =>
        computePeriodicRetention(definition, dataset([{ ...first, occurredAt }]), options),
      ).toThrow(InvalidBehaviorMetricProblem);
    }
  });
  it("uses tenant subjects without combining distinct subject identities", () => {
    const input = {
      ...dataset([
        event("tenant-a", "2024-02-20T10:00:00Z"),
        event("tenant-b", "2024-02-20T10:00:00Z"),
        event("tenant-a", "2024-02-27T10:00:00Z"),
      ]),
      subjectKind: "tenant",
    };
    expect(
      computePeriodicRetention({ ...definition, subjectKind: "tenant" }, input, options),
    ).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
  });
  it("preserves deleted subjects unless the definition explicitly excludes them", () => {
    const input = {
      ...dataset([
        event("a", "2024-02-20T10:00:00Z"),
        event("b", "2024-02-20T10:00:00Z"),
        event("a", "2024-02-27T10:00:00Z"),
      ]),
      deletedSubjectIds: ["b"],
    };
    expect(computePeriodicRetention(definition, input, options)).toMatchObject({
      denominator: 2,
      value: 0.5,
    });
    expect(
      computePeriodicRetention({ ...definition, deletedSubjectPolicy: "exclude" }, input, options),
    ).toMatchObject({ denominator: 1, value: 1 });
  });
  it("distinguishes a DST calendar day from a rolling 24 hours and uses half-open bounds", () => {
    const zoned = { ...definition, timezone: "America/New_York" };
    const input = {
      ...dataset([event("a", "2024-03-10T05:00:00Z"), event("b", "2024-03-11T04:00:00Z")]),
      timezone: zoned.timezone,
      completeThrough: "2024-03-12T00:00:00Z",
    };
    const calendar = computeFrequencyDistribution(zoned, input, {
      window: { kind: "calendar", from: "2024-03-10T05:00:00Z", to: "2024-03-11T04:00:00Z" },
      measure: "count",
    });
    const rolling = computeFrequencyDistribution(zoned, input, {
      window: { kind: "rolling", anchor: "2024-03-10T05:00:00Z", durationMs: 86400000, index: 0 },
      measure: "count",
    });
    expect(calendar.denominator).toBe(1);
    expect(rolling.denominator).toBe(2);
    expect(Date.parse(calendar.window.to) - Date.parse(calendar.window.from)).toBe(23 * 3600000);
  });
  it("counts local activity dates rather than UTC dates", () => {
    const zoned = { ...definition, timezone: "Asia/Seoul" };
    const input = {
      ...dataset([event("a", "2024-02-29T14:00:00Z"), event("a", "2024-02-29T16:00:00Z")]),
      timezone: zoned.timezone,
    };
    expect(
      computeFrequencyDistribution(zoned, input, {
        window: { kind: "rolling", anchor: "2024-02-29T00:00:00Z", durationMs: 86400000, index: 0 },
        measure: "activeDays",
      }).subjects[0].activeDays,
    ).toBe(2);
  });
  it("rejects mismatched tenant, missing tenant, definition, time, and timezone with a stable Problem", () => {
    const first = event("a", "2024-02-20T10:00:00Z");
    const invalid = [
      dataset([{ ...first, scope: { ...scope, tenantId: "tenant-b" } }]),
      { ...dataset([first]), scope: { ...scope, tenantId: "" } },
      { ...dataset([first]), version: "2" },
      dataset([{ ...first, occurredAt: "2024-02-30T10:00:00Z" }]),
      dataset([{ ...first, occurredAt: "2024-02-20" }]),
    ];
    for (const input of invalid)
      expect(() => computePeriodicRetention(definition, input, options)).toThrow(
        InvalidBehaviorMetricProblem,
      );
    expect(() =>
      computePeriodicRetention({ ...definition, timezone: "invalid" }, dataset([]), options),
    ).toThrow(InvalidBehaviorMetricProblem);
    expect(() =>
      computeFrequencyDistribution(definition, dataset([]), {
        window: { kind: "calendar", from: "2024-02-19T01:00:00Z", to: "2024-02-20T00:00:00Z" },
        measure: "count",
      }),
    ).toThrow(InvalidBehaviorMetricProblem);
  });
});
