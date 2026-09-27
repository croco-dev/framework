import {
  computeCohortRetention,
  computeFrequencyDistribution,
  computePeriodicRetention,
} from "@croco/metrics-core";
import type { BehaviorDataset, BehaviorDefinition, BehaviorObservation } from "@croco/metrics-core";

const scope = { appId: "reports", environment: "demo", tenantId: "tenant-a" };
const definition: BehaviorDefinition = {
  id: "report.saved",
  version: "1",
  subjectKind: "user",
  timezone: "UTC",
  actions: ["report.saved"],
  deletedSubjectPolicy: "include",
  historyStart: "2026-01-01T00:00:00Z",
};
const observation = (
  subjectId: string,
  eventId: string,
  occurredAt: string,
): BehaviorObservation => ({
  subjectId,
  eventId,
  occurredAt,
  action: "report.saved",
  source: "example",
  scope,
});
const events = [
  ...Array.from({ length: 100 }, (_, index) =>
    observation(`prior-${index}`, `prior-${index}`, "2026-09-08T12:00:00Z"),
  ),
  ...Array.from({ length: 40 }, (_, index) =>
    observation(`prior-${index}`, `returned-${index}`, "2026-09-15T12:00:00Z"),
  ),
  ...Array.from({ length: 80 }, (_, index) =>
    observation(`new-${index}`, `new-${index}`, "2026-09-15T12:00:00Z"),
  ),
  observation("new-0", "new-0-second", "2026-09-15T13:00:00Z"),
  observation("new-0", "new-0-third", "2026-09-15T14:00:00Z"),
];
const dataset: BehaviorDataset = {
  definitionId: definition.id,
  version: definition.version,
  subjectKind: definition.subjectKind,
  timezone: definition.timezone,
  scope,
  events,
  knownHistoryFrom: definition.historyStart,
  completeThrough: "2026-09-21T00:00:00Z",
};
const baseline = {
  kind: "calendar",
  from: "2026-09-07T00:00:00Z",
  to: "2026-09-14T00:00:00Z",
} as const;
const returning = {
  kind: "calendar",
  from: "2026-09-14T00:00:00Z",
  to: "2026-09-21T00:00:00Z",
} as const;

const periodic = computePeriodicRetention(definition, dataset, { baseline, returning });
const cohort = computeCohortRetention(definition, dataset, { baseline, returning });
const frequency = computeFrequencyDistribution(definition, dataset, {
  window: returning,
  measure: "count",
});
const activeDays = computeFrequencyDistribution(definition, dataset, {
  window: returning,
  measure: "activeDays",
});

if (periodic.numerator !== 40 || periodic.denominator !== 100 || periodic.value !== 0.4) {
  throw new Error("Periodic retention did not match the known example");
}
if (frequency.subjects.find((subject) => subject.subjectId === "new-0")?.count !== 3) {
  throw new Error("Action count did not preserve three distinct events");
}
if (activeDays.subjects.find((subject) => subject.subjectId === "new-0")?.activeDays !== 1) {
  throw new Error("Active days did not use distinct local days");
}

console.log(
  JSON.stringify({
    periodic: {
      numerator: periodic.numerator,
      denominator: periodic.denominator,
      value: periodic.value,
      availability: periodic.availability,
    },
    cohort: {
      numerator: cohort.numerator,
      denominator: cohort.denominator,
      value: cohort.value,
      availability: cohort.availability,
    },
    countBuckets: frequency.buckets,
    activeDayBuckets: activeDays.buckets,
  }),
);
