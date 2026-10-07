import { normalizeActivationRow } from "@croco/metrics-core/runtime";
import type { ActivationDefinition } from "@croco/metrics-core";
import type { ActivationColumnBinding } from "@croco/metrics-core/runtime";
import type { SourceSchema } from "@croco/etl-core/source";

const day = 86_400_000;
export const definition: ActivationDefinition = {
  id: "first-week-activation",
  version: 1,
  subjectKind: "user",
  cohortPolicy: "new",
  timezone: "UTC",
  unit: "subject",
  sourceRunRef: "synthetic-100-v1",
  sourceRevisions: { normalized: "v1" },
  windows: [
    { id: "week", fromMs: 0, toMs: 7 * day },
    { id: "fortnight", fromMs: 0, toMs: 14 * day },
  ],
  outcomeWindow: { fromMs: 14 * day, toMs: 28 * day },
  candidates: [
    ...[1, 2, 3].map((threshold) => ({
      id: `frequency-${threshold}`,
      actionId: "publish",
      windowId: "week",
      threshold,
      countMode: "frequency" as const,
    })),
    {
      id: "days-2",
      actionId: "publish",
      windowId: "fortnight",
      threshold: 2,
      countMode: "activeDays",
    },
  ],
  minSupport: 0.1,
  maxRows: 1000,
  maxCandidates: 10,
};
export const binding: ActivationColumnBinding = {
  subjectId: "subjectId",
  anchorAt: "anchorAt",
  cohort: "cohort",
  outcome: "outcome",
  completeThrough: "completeThrough",
  actionCountsByWindow: {
    week: { publish: "weekFrequency" },
    fortnight: { publish: "fortnightFrequency" },
  },
  activeDaysByWindow: { week: { publish: "weekDays" }, fortnight: { publish: "fortnightDays" } },
};
export const flatRows = Array.from({ length: 100 }, (_, index) => {
  const count = index < 10 ? 3 : index < 20 || (index >= 30 && index < 35) ? 2 : index < 40 ? 1 : 0;
  return {
    subjectId: `subject-${String(index).padStart(3, "0")}`,
    anchorAt: "2026-08-01T00:00:00.000Z",
    cohort: "new",
    outcome: String(index < 30 || (index >= 40 && index < 60)),
    completeThrough: "2026-08-30T00:00:00.000Z",
    weekFrequency: count,
    fortnightFrequency: count,
    weekDays: count,
    fortnightDays: count,
  };
});
const firstRow = flatRows[0];
if (!firstRow) throw new Error("Synthetic fixture is empty");
const columnNames = Object.keys(firstRow);
export const rows = flatRows.map((row) => normalizeActivationRow(row, binding, definition));
export function schema(format: "csv" | "jsonl"): SourceSchema {
  return {
    format,
    encoding: "utf-8",
    ...(format === "csv" ? { header: true } : {}),
    fields: columnNames.map((name) => ({
      name,
      type: name.endsWith("Frequency") || name.endsWith("Days") ? "number" : "string",
    })),
    limits: { maxBytes: 200_000, maxRecords: 1000, maxRowBytes: 4096 },
  };
}
export async function* importedBytes(format: "csv" | "jsonl") {
  const text =
    format === "jsonl"
      ? flatRows.map((row) => JSON.stringify(row)).join("\n") + "\n"
      : [columnNames.join(","), ...flatRows.map((row) => Object.values(row).join(","))].join("\n") +
        "\n";
  yield new TextEncoder().encode(text);
}

// Independent event fixture: timestamps, rather than aggregate totals, define achievement times.
const timedEvents = [
  { subjectId: "event-subject-a", at: "2026-08-02T00:00:00.000Z" },
  { subjectId: "event-subject-a", at: "2026-08-03T00:00:00.000Z" },
  { subjectId: "event-subject-a", at: "2026-08-04T00:00:00.000Z" },
  { subjectId: "event-subject-b", at: "2026-08-03T00:00:00.000Z" },
] as const;
export const timedDefinition: ActivationDefinition = {
  ...definition,
  sourceRunRef: "synthetic-event-times-v1",
  sourceRevisions: { events: "v1" },
};
export const timedRows = ["event-subject-a", "event-subject-b"].map((subjectId) => {
  const events = timedEvents
    .filter((event) => event.subjectId === subjectId)
    .map((event) => event.at);
  const count = events.length;
  return {
    subjectId,
    anchorAt: "2026-08-01T00:00:00.000Z",
    cohort: "new" as const,
    outcome: true,
    completeThrough: "2026-08-30T00:00:00.000Z",
    outcomeWindow: definition.outcomeWindow,
    actionCountsByWindow: { week: { publish: count }, fortnight: { publish: count } },
    activeDaysByWindow: { week: { publish: count }, fortnight: { publish: count } },
    achievementAtByCandidate: Object.fromEntries(
      definition.candidates.flatMap((candidate) => {
        const at = events[candidate.threshold - 1];
        return at ? [[candidate.id, at]] : [];
      }),
    ),
  };
});
