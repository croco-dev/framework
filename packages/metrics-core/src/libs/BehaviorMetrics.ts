import { Problem, ProblemCategory } from "@croco/problems-core";

export type BehaviorScope = { appId: string; environment: string; tenantId: string };
export type BehaviorDefinition = {
  id: string;
  version: string;
  subjectKind: string;
  timezone: string;
  actions: readonly string[];
  deletedSubjectPolicy: "include" | "exclude";
  /** Earliest possible behavior in this definition, including imported history. */
  historyStart: string;
};
export type BehaviorObservation = {
  subjectId: string;
  source: string;
  eventId: string;
  occurredAt: string;
  action: string;
  scope: BehaviorScope;
};
export type BehaviorDataset = {
  /** Immutable host source run or warehouse snapshot reference, when available. */
  sourceRef?: string;
  definitionId: string;
  version: string;
  subjectKind: string;
  timezone: string;
  scope: BehaviorScope;
  events: readonly BehaviorObservation[];
  completeThrough?: string;
  knownHistoryFrom?: string;
  deletedSubjectIds?: readonly string[];
};
export type BehaviorWindow =
  | { kind: "calendar"; from: string; to: string }
  | { kind: "rolling"; anchor: string; durationMs: number; index: number };
export type BehaviorResolvedWindow = { from: string; to: string };
export type BehaviorSourceRef = { source: string; eventId: string; scope: BehaviorScope };
export type BehaviorAvailability = "complete" | "provisional" | "insufficient";
export type BehaviorReason =
  | "zero-denominator"
  | "incomplete-observation"
  | "unknown-history"
  | null;
export type BehaviorSubjectReason =
  | "retained"
  | "not-returned"
  | "outside-baseline"
  | "earlier-activity"
  | "deleted"
  | "active"
  | "unknown-history";
export type BehaviorSubjectMembership = {
  subjectId: string;
  inDenominator: boolean;
  inNumerator: boolean;
  reason: BehaviorSubjectReason;
  count: number;
  activeDays: number;
};
export type BehaviorMetricResult = {
  definitionId: string;
  definitionVersion: string;
  numerator: number;
  denominator: number;
  /** Ratio in [0, 1]; null when observation cannot establish a value. */
  value: number | null;
  availability: BehaviorAvailability;
  reason: BehaviorReason;
  window: BehaviorResolvedWindow;
  sourceRefs: BehaviorSourceRef[];
  subjects: BehaviorSubjectMembership[];
};
export type BehaviorRetentionOptions = { baseline: BehaviorWindow; returning: BehaviorWindow };
export type BehaviorRetentionResult = BehaviorMetricResult & {
  baselineWindow: BehaviorResolvedWindow;
};
export type BehaviorFrequencyOptions = { window: BehaviorWindow; measure: "count" | "activeDays" };
export type BehaviorFrequencyResult = BehaviorMetricResult & {
  measure: "count" | "activeDays";
  buckets: { frequency: number; numerator: number; denominator: number; value: number | null }[];
};

export class InvalidBehaviorMetricProblem extends Problem {
  readonly code = "metrics-core/invalid-behavior-metric";
  readonly category = ProblemCategory.ValidationError;
  constructor(readonly field: string) {
    super(undefined, undefined, `Invalid behavior metric field: ${field}`);
  }
}
export class ConflictingBehaviorEventProblem extends Problem {
  readonly code = "metrics-core/conflicting-behavior-event";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(
      undefined,
      undefined,
      "Conflicting observations share the same scope, source and event identity",
    );
  }
}
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function requireValue(condition: boolean, field: string): asserts condition {
  if (!condition) throw new InvalidBehaviorMetricProblem(field);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function instant(value: string, field: string): number {
  requireValue(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    field,
  );
  const time = Date.parse(value);
  const date = value.slice(0, 10);
  const day = Date.parse(`${date}T00:00:00Z`);
  requireValue(
    Number.isFinite(time) &&
      Number.isFinite(day) &&
      Number(value.slice(11, 13)) < 24 &&
      new Date(day).toISOString().slice(0, 10) === date,
    field,
  );
  return time;
}
function scopeKey(scope: BehaviorScope): string {
  requireValue(
    scope != null &&
      nonempty(scope.appId) &&
      nonempty(scope.environment) &&
      nonempty(scope.tenantId),
    "scope",
  );
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
}
function formatter(timezone: string): Intl.DateTimeFormat {
  try {
    requireValue(nonempty(timezone), "timezone");
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new InvalidBehaviorMetricProblem("timezone");
  }
}
function localParts(format: Intl.DateTimeFormat, time: number): Record<string, string> {
  return Object.fromEntries(format.formatToParts(time).map(({ type, value }) => [type, value]));
}
function resolveWindow(
  window: BehaviorWindow,
  format: Intl.DateTimeFormat,
): BehaviorResolvedWindow {
  requireValue(
    window != null && (window.kind === "calendar" || window.kind === "rolling"),
    "window.kind",
  );
  let from: number;
  let to: number;
  if (window.kind === "calendar") {
    from = instant(window.from, "window.from");
    to = instant(window.to, "window.to");
    for (const time of [from, to]) {
      const parts = localParts(format, time);
      requireValue(
        parts.hour === "00" && parts.minute === "00" && parts.second === "00" && time % 1000 === 0,
        "window.calendar-boundary",
      );
    }
  } else {
    requireValue(
      Number.isSafeInteger(window.durationMs) &&
        window.durationMs > 0 &&
        Number.isSafeInteger(window.index),
      "window.rolling",
    );
    from = instant(window.anchor, "window.anchor") + window.durationMs * window.index;
    to = from + window.durationMs;
  }
  requireValue(
    Number.isSafeInteger(from) &&
      Number.isSafeInteger(to) &&
      from < to &&
      Math.abs(from) <= 8640000000000000 &&
      Math.abs(to) <= 8640000000000000,
    "window.range",
  );
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}
function prepare(definition: BehaviorDefinition, dataset: BehaviorDataset) {
  requireValue(definition != null && dataset != null, "definition");
  requireValue(
    nonempty(definition.id) && nonempty(definition.version) && nonempty(definition.subjectKind),
    "definition",
  );
  requireValue(
    Array.isArray(definition.actions) &&
      definition.actions.length > 0 &&
      definition.actions.every(nonempty) &&
      new Set(definition.actions).size === definition.actions.length,
    "actions",
  );
  requireValue(
    definition.deletedSubjectPolicy === "include" || definition.deletedSubjectPolicy === "exclude",
    "deletedSubjectPolicy",
  );
  const format = formatter(definition.timezone);
  const historyStart = instant(definition.historyStart, "historyStart");
  requireValue(
    dataset.definitionId === definition.id &&
      dataset.version === definition.version &&
      dataset.subjectKind === definition.subjectKind &&
      dataset.timezone === definition.timezone,
    "dataset.definition",
  );
  const scope = scopeKey(dataset.scope);
  const complete =
    dataset.completeThrough === undefined
      ? undefined
      : instant(dataset.completeThrough, "completeThrough");
  const history =
    dataset.knownHistoryFrom === undefined
      ? undefined
      : instant(dataset.knownHistoryFrom, "knownHistoryFrom");
  requireValue(
    complete === undefined || history === undefined || history <= complete,
    "history.range",
  );
  requireValue(Array.isArray(dataset.events), "events");
  requireValue(
    dataset.deletedSubjectIds === undefined ||
      (Array.isArray(dataset.deletedSubjectIds) && dataset.deletedSubjectIds.every(nonempty)),
    "deletedSubjectIds",
  );
  const seen = new Map<string, string>();
  const events: BehaviorObservation[] = [];
  for (const event of dataset.events) {
    requireValue(
      event != null &&
        nonempty(event.subjectId) &&
        nonempty(event.source) &&
        nonempty(event.eventId) &&
        nonempty(event.action),
      "event",
    );
    requireValue(scopeKey(event.scope) === scope, "event.scope");
    const time = instant(event.occurredAt, "event.occurredAt");
    requireValue(
      time >= historyStart && (history === undefined || time >= history),
      "event.history",
    );
    const key = JSON.stringify([scope, event.source, event.eventId]);
    const content = JSON.stringify([event.subjectId, event.action, time]);
    if (seen.has(key)) {
      if (seen.get(key) !== content) throw new ConflictingBehaviorEventProblem();
      continue;
    }
    seen.set(key, content);
    if (definition.actions.includes(event.action)) events.push(event);
  }
  events.sort(
    (a, b) =>
      instant(a.occurredAt, "occurredAt") - instant(b.occurredAt, "occurredAt") ||
      compareText(a.subjectId, b.subjectId) ||
      compareText(a.source, b.source) ||
      compareText(a.eventId, b.eventId),
  );
  return {
    events,
    format,
    complete,
    history,
    historyStart,
    deleted: new Set(dataset.deletedSubjectIds ?? []),
  };
}
function inside(event: BehaviorObservation, window: BehaviorResolvedWindow): boolean {
  const time = Date.parse(event.occurredAt);
  return time >= Date.parse(window.from) && time < Date.parse(window.to);
}
function groupSubjects(events: BehaviorObservation[]): Map<string, BehaviorObservation[]> {
  const groups = new Map<string, BehaviorObservation[]>();
  for (const event of events) {
    const group = groups.get(event.subjectId);
    if (group) group.push(event);
    else groups.set(event.subjectId, [event]);
  }
  return groups;
}
function counts(events: BehaviorObservation[], format: Intl.DateTimeFormat) {
  return {
    count: events.length,
    activeDays: new Set(
      events.map((event) => {
        const parts = localParts(format, Date.parse(event.occurredAt));
        return `${parts.year}-${parts.month}-${parts.day}`;
      }),
    ).size,
  };
}
function result(
  definition: BehaviorDefinition,
  prepared: ReturnType<typeof prepare>,
  window: BehaviorResolvedWindow,
  subjects: BehaviorSubjectMembership[],
  relevant: BehaviorObservation[],
  unknownHistory: boolean,
): BehaviorMetricResult {
  const denominator = subjects.filter((subject) => subject.inDenominator).length;
  const numerator = subjects.filter((subject) => subject.inNumerator).length;
  const availability: BehaviorAvailability = unknownHistory
    ? "insufficient"
    : prepared.complete === undefined || prepared.complete < Date.parse(window.to)
      ? "provisional"
      : "complete";
  const reason: BehaviorReason = unknownHistory
    ? "unknown-history"
    : availability === "provisional"
      ? "incomplete-observation"
      : denominator === 0
        ? "zero-denominator"
        : null;
  return {
    definitionId: definition.id,
    definitionVersion: definition.version,
    numerator,
    denominator,
    value: availability === "complete" && denominator > 0 ? numerator / denominator : null,
    availability,
    reason,
    window,
    subjects,
    sourceRefs: relevant.map((event) => ({
      source: event.source,
      eventId: event.eventId,
      scope: { ...event.scope },
    })),
  };
}
function retention(
  definition: BehaviorDefinition,
  dataset: BehaviorDataset,
  options: BehaviorRetentionOptions,
  cohort: boolean,
): BehaviorRetentionResult {
  const prepared = prepare(definition, dataset);
  requireValue(options != null, "options");
  const baselineWindow = resolveWindow(options.baseline, prepared.format);
  const window = resolveWindow(options.returning, prepared.format);
  requireValue(Date.parse(baselineWindow.to) <= Date.parse(window.from), "window.order");
  const unknownHistory =
    prepared.history === undefined ||
    prepared.history > (cohort ? prepared.historyStart : Date.parse(baselineWindow.from));
  const subjects = [...groupSubjects(prepared.events)]
    .sort(([a], [b]) => compareText(a, b))
    .map(([subjectId, events]) => {
      const baseline = events.some((event) => inside(event, baselineWindow));
      const earlier =
        cohort &&
        events.some((event) => Date.parse(event.occurredAt) < Date.parse(baselineWindow.from));
      const deleted =
        definition.deletedSubjectPolicy === "exclude" && prepared.deleted.has(subjectId);
      const inDenominator = baseline && !earlier && !deleted && !(cohort && unknownHistory);
      const returning = events.filter((event) => inside(event, window));
      const inNumerator = inDenominator && returning.length > 0;
      const reason: BehaviorSubjectReason = deleted
        ? "deleted"
        : cohort && unknownHistory
          ? "unknown-history"
          : earlier
            ? "earlier-activity"
            : !baseline
              ? "outside-baseline"
              : inNumerator
                ? "retained"
                : "not-returned";
      return {
        subjectId,
        inDenominator,
        inNumerator,
        reason,
        ...counts(returning, prepared.format),
      };
    });
  const relevant = prepared.events.filter(
    (event) =>
      inside(event, baselineWindow) ||
      inside(event, window) ||
      (cohort && Date.parse(event.occurredAt) < Date.parse(baselineWindow.from)),
  );
  return {
    ...result(definition, prepared, window, subjects, relevant, unknownHistory),
    baselineWindow,
  };
}
export function computePeriodicRetention(
  definition: BehaviorDefinition,
  dataset: BehaviorDataset,
  options: BehaviorRetentionOptions,
): BehaviorRetentionResult {
  return retention(definition, dataset, options, false);
}
export function computeCohortRetention(
  definition: BehaviorDefinition,
  dataset: BehaviorDataset,
  options: BehaviorRetentionOptions,
): BehaviorRetentionResult {
  return retention(definition, dataset, options, true);
}
export function computeFrequencyDistribution(
  definition: BehaviorDefinition,
  dataset: BehaviorDataset,
  options: BehaviorFrequencyOptions,
): BehaviorFrequencyResult {
  const prepared = prepare(definition, dataset);
  requireValue(
    options != null && (options.measure === "count" || options.measure === "activeDays"),
    "measure",
  );
  const window = resolveWindow(options.window, prepared.format);
  const events = prepared.events.filter((event) => inside(event, window));
  const subjects = [...groupSubjects(events)]
    .sort(([a], [b]) => compareText(a, b))
    .map(([subjectId, subjectEvents]) => {
      const included =
        definition.deletedSubjectPolicy === "include" || !prepared.deleted.has(subjectId);
      return {
        subjectId,
        inDenominator: included,
        inNumerator: included,
        reason: included ? ("active" as const) : ("deleted" as const),
        ...counts(subjectEvents, prepared.format),
      };
    });
  const base = result(
    definition,
    prepared,
    window,
    subjects,
    events,
    prepared.history === undefined || prepared.history > Date.parse(window.from),
  );
  const frequencies = new Map<number, number>();
  for (const subject of subjects.filter((subject) => subject.inDenominator))
    frequencies.set(subject[options.measure], (frequencies.get(subject[options.measure]) ?? 0) + 1);
  return {
    ...base,
    measure: options.measure,
    buckets: [...frequencies]
      .sort(([a], [b]) => a - b)
      .map(([frequency, numerator]) => ({
        frequency,
        numerator,
        denominator: base.denominator,
        value:
          base.availability === "complete" && base.denominator > 0
            ? numerator / base.denominator
            : null,
      })),
  };
}
