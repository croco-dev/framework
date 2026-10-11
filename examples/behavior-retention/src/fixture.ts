import type { BehaviorDataset, BehaviorDefinition, BehaviorObservation } from "@croco/metrics-core";
export const scope = { appId: "reports", environment: "demo", tenantId: "tenant-a" };
export const definition: BehaviorDefinition = {
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
export const dataset: BehaviorDataset = {
  sourceRef: "synthetic-v1",
  definitionId: definition.id,
  version: definition.version,
  subjectKind: definition.subjectKind,
  timezone: definition.timezone,
  scope,
  events,
  knownHistoryFrom: definition.historyStart,
  completeThrough: "2026-09-21T00:00:00Z",
};
export const baseline = {
  kind: "calendar",
  from: "2026-09-07T00:00:00Z",
  to: "2026-09-14T00:00:00Z",
} as const;
export const returning = {
  kind: "calendar",
  from: "2026-09-14T00:00:00Z",
  to: "2026-09-21T00:00:00Z",
} as const;

export const binding = {
  subjectId: "subjectId",
  source: "source",
  eventId: "eventId",
  occurredAt: "occurredAt",
  action: "action",
  appId: "appId",
  environment: "environment",
  tenantId: "tenantId",
};
export const schema = {
  format: "jsonl",
  encoding: "utf-8",
  fields: Object.values(binding).map((name) => ({ name, type: "string" as const })),
  limits: { maxBytes: 100000, maxRecords: 300, maxRowBytes: 1000 },
} as const;
export const { events: _events, ...metadata } = dataset;
