import { Problem, ProblemCategory } from "@croco/problems-core";

export type PageExperienceScope = { app: string; environment: string; tenant: string };
export type PageExperienceDefinition = {
  id: string;
  version: number;
  page: string;
  contentCondition: string;
  contentMinIntersectionRatio: number;
  minVisibleMs: number;
  engagementActions: readonly string[];
  valueAction: string;
  unit: "session" | "subject" | "pageInstance";
  sessionWindowMs: number;
  timezone: string;
  hiddenTime: "exclude";
};
/** Scope and subject membership are supplied by a trusted server source, never a browser body. */
export type PageExperienceRow = {
  id: string;
  source: string;
  kind: "session" | "view" | "content" | "visible" | "action" | "attempt" | "committed";
  session: string;
  subject: string;
  pageInstance: string;
  page: string;
  occurredAt: string;
  receivedAt: string;
  value: string;
};
export type PageExperienceInput = {
  scope: PageExperienceScope;
  definition: PageExperienceDefinition;
  sourceRef: string;
  sourceRevision: string;
  snapshotRef: string;
  window: { from: string; to: string };
  cutoff: string;
  allowedLatenessMs: number;
  /** Coverage is source evidence, not inferred from the last received event. */
  completeThrough: string | null;
  coverage: "complete" | "partial" | "unknown";
  deletedSubjects: readonly string[];
  rows: readonly PageExperienceRow[];
};
export type PageExperienceRatio = {
  numerator: number;
  denominator: number;
  unobserved: number;
  value: number | null;
};
export type PageExperienceReport = {
  definition: PageExperienceDefinition;
  sourceRef: string;
  sourceRevision: string;
  snapshotRef: string;
  definitionHash: string;
  inputHash: string;
  window: PageExperienceInput["window"];
  cutoff: string;
  allowedLatenessMs: number;
  revision: string;
  coverage: PageExperienceInput["coverage"];
  unit: PageExperienceDefinition["unit"];
  viewed: number;
  engaged: PageExperienceRatio;
  attempted: PageExperienceRatio;
  committed: PageExperienceRatio;
  /** Confirmed outcomes remain visible even without a linked browser event. */
  confirmedOutcomes: number;
  unlinkedCommitted: number;
  bounce: PageExperienceRatio;
  completeSessions: number;
  openSessions: number;
  unknownSessions: number;
  lateRows: number;
  diagnostics: readonly string[];
};
export class PageExperienceProblem extends Problem {
  readonly code = "metrics/page-experience/invalid";
  readonly category = ProblemCategory.ValidationError;
  constructor(readonly field: string) {
    super(undefined, undefined, `Invalid page experience ${field}`);
  }
}
export function requirePageExperience(condition: unknown, field: string): asserts condition {
  if (!condition) throw new PageExperienceProblem(field);
}
export function pageExperienceToken(value: unknown): asserts value is string {
  requirePageExperience(
    typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value),
    "reference",
  );
}
export function pageExperienceTime(value: unknown): number {
  requirePageExperience(
    typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value),
    "time",
  );
  const time = Date.parse(value);
  requirePageExperience(Number.isFinite(time) && new Date(time).toISOString() === value, "time");
  return time;
}
export function validatePageExperienceDefinition(value: PageExperienceDefinition): void {
  requirePageExperience(value && typeof value === "object", "definition");
  [value.id, value.page, value.contentCondition, value.valueAction].forEach(pageExperienceToken);
  requirePageExperience(
    Array.isArray(value.engagementActions) && value.engagementActions.length <= 32,
    "actions",
  );
  value.engagementActions.forEach(pageExperienceToken);
  requirePageExperience(
    Number.isFinite(value.contentMinIntersectionRatio) &&
      value.contentMinIntersectionRatio > 0 &&
      value.contentMinIntersectionRatio <= 1,
    "content-visibility",
  );
  requirePageExperience(
    new Set(value.engagementActions).size === value.engagementActions.length,
    "actions",
  );
  requirePageExperience(Number.isSafeInteger(value.version) && value.version > 0, "version");
  requirePageExperience(
    Number.isSafeInteger(value.sessionWindowMs) &&
      value.sessionWindowMs > 0 &&
      value.sessionWindowMs <= 86400000,
    "session-window",
  );
  requirePageExperience(
    Number.isSafeInteger(value.minVisibleMs) &&
      value.minVisibleMs > 0 &&
      value.minVisibleMs <= value.sessionWindowMs,
    "visible-threshold",
  );
  requirePageExperience(
    ["session", "subject", "pageInstance"].includes(value.unit) && value.hiddenTime === "exclude",
    "policy",
  );
  requirePageExperience(
    typeof value.timezone === "string" && value.timezone.length > 0,
    "timezone",
  );
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone }).format(0);
  } catch {
    throw new PageExperienceProblem("timezone");
  }
}
export function validatePageExperienceRow(row: PageExperienceRow): PageExperienceRow {
  requirePageExperience(row && typeof row === "object" && Object.keys(row).length === 10, "row");
  for (const key of ["id", "source", "session", "subject", "pageInstance", "page"] as const)
    pageExperienceToken(row[key]);
  requirePageExperience(
    ["session", "view", "content", "visible", "action", "attempt", "committed"].includes(row.kind),
    "kind",
  );
  const occurred = pageExperienceTime(row.occurredAt);
  requirePageExperience(pageExperienceTime(row.receivedAt) >= occurred, "received-at");
  if (row.kind === "visible")
    requirePageExperience(
      typeof row.value === "string" && /^(0|[1-9]\d{0,7})$/.test(row.value),
      "visible-time",
    );
  else pageExperienceToken(row.value);
  return {
    id: row.id,
    source: row.source,
    kind: row.kind,
    session: row.session,
    subject: row.subject,
    pageInstance: row.pageInstance,
    page: row.page,
    occurredAt: row.occurredAt,
    receivedAt: row.receivedAt,
    value: row.value,
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function hashPageExperience(value: unknown): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** Ordered funnel per actual page instance, then distinct units within one session cohort. */
export async function calculatePageExperience(
  raw: PageExperienceInput,
): Promise<PageExperienceReport> {
  requirePageExperience(raw && typeof raw === "object", "input");
  const input = structuredClone(raw);
  const d = input.definition;
  validatePageExperienceDefinition(d);
  requirePageExperience(input.scope && typeof input.scope === "object", "scope");
  Object.values(input.scope).forEach(pageExperienceToken);
  requirePageExperience(
    Object.keys(input.scope).length === 3 &&
      ["app", "environment", "tenant"].every((k) => Object.hasOwn(input.scope, k)),
    "scope",
  );
  [input.sourceRef, input.sourceRevision, input.snapshotRef].forEach(pageExperienceToken);
  requirePageExperience(input.window && typeof input.window === "object", "window");
  const from = pageExperienceTime(input.window.from),
    to = pageExperienceTime(input.window.to),
    cutoff = pageExperienceTime(input.cutoff);
  requirePageExperience(from < to && cutoff >= to, "window");
  requirePageExperience(
    Number.isSafeInteger(input.allowedLatenessMs) &&
      input.allowedLatenessMs >= 0 &&
      input.allowedLatenessMs <= 86400000,
    "lateness",
  );
  requirePageExperience(["complete", "partial", "unknown"].includes(input.coverage), "coverage");
  const through = input.completeThrough === null ? null : pageExperienceTime(input.completeThrough);
  requirePageExperience(through === null || through <= cutoff, "coverage-time");
  requirePageExperience(
    Array.isArray(input.deletedSubjects) && input.deletedSubjects.length <= 100000,
    "deletions",
  );
  input.deletedSubjects.forEach(pageExperienceToken);
  requirePageExperience(Array.isArray(input.rows) && input.rows.length <= 100000, "row-budget");
  const unique = new Map<string, PageExperienceRow>();
  let lateRows = 0;
  for (const original of input.rows) {
    const row = validatePageExperienceRow(original);
    const key = canonical([row.source, row.id]);
    const prior = unique.get(key);
    requirePageExperience(!prior || canonical(prior) === canonical(row), "conflicting-event");
    unique.set(key, row);
  }
  const rows = [...unique.values()]
    .filter((row) => {
      if (
        input.deletedSubjects.includes(row.subject) ||
        pageExperienceTime(row.receivedAt) > cutoff
      )
        return false;
      if (
        pageExperienceTime(row.receivedAt) - pageExperienceTime(row.occurredAt) >
        input.allowedLatenessMs
      ) {
        lateRows++;
        return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        pageExperienceTime(a.occurredAt) - pageExperienceTime(b.occurredAt) ||
        a.id.localeCompare(b.id),
    );
  const sessions = new Map<string, PageExperienceRow>();
  for (const row of rows.filter((r) => r.kind === "session")) {
    requirePageExperience(!sessions.has(row.session), "duplicate-session");
    sessions.set(row.session, row);
  }
  const instances = new Map<string, PageExperienceRow[]>();
  for (const row of rows.filter((r) => r.kind !== "session")) {
    const session = sessions.get(row.session);
    // A receipt without UI/session telemetry is a real outcome, outside the page funnel.
    if (!session) {
      requirePageExperience(row.kind === "committed", "missing-session");
      continue;
    }
    requirePageExperience(row.subject === session.subject, "session-subject");
    const start = pageExperienceTime(session.occurredAt),
      at = pageExperienceTime(row.occurredAt);
    requirePageExperience(at >= start && at < start + d.sessionWindowMs, "session-time");
    const key = canonical([row.session, row.pageInstance]);
    const prior = instances.get(key) ?? [];
    requirePageExperience(!prior[0] || prior[0].page === row.page, "instance-page");
    prior.push(row);
    instances.set(key, prior);
  }
  const viewed = new Set<string>(),
    engaged = new Set<string>(),
    attempted = new Set<string>(),
    committed = new Set<string>();
  const bounced = new Set<string>(),
    eligibleBounce = new Set<string>();
  const cohortSessions = new Set<string>(),
    linkedReceipts = new Set<string>();
  const unit = (row: PageExperienceRow) =>
    d.unit === "subject"
      ? row.subject
      : d.unit === "session"
        ? row.session
        : canonical([row.session, row.pageInstance]);
  let completeSessions = 0,
    openSessions = 0,
    unknownSessions = 0;
  const sessionState = new Map<string, "complete" | "open" | "unknown">();
  for (const session of sessions.values()) {
    const start = pageExperienceTime(session.occurredAt),
      end = start + d.sessionWindowMs;
    if (start < from || start >= to) continue;
    cohortSessions.add(session.session);
    const state =
      end + input.allowedLatenessMs > cutoff
        ? "open"
        : input.coverage !== "complete" || through === null || through < end
          ? "unknown"
          : "complete";
    sessionState.set(session.session, state);
    if (state === "open") openSessions++;
    else if (state === "unknown") unknownSessions++;
    else completeSessions++;
  }
  const receiptIds = new Set<string>();
  for (const row of rows.filter(
    (r) =>
      r.kind === "committed" &&
      r.page === d.page &&
      r.value === d.valueAction &&
      (cohortSessions.has(r.session) ||
        (!sessions.has(r.session) &&
          pageExperienceTime(r.occurredAt) >= from &&
          pageExperienceTime(r.occurredAt) < to)),
  )) {
    requirePageExperience(!receiptIds.has(canonical([row.source, row.id])), "receipt");
    receiptIds.add(canonical([row.source, row.id]));
  }
  const unitKnown = new Map<string, boolean>();
  const unitEngaged = new Set<string>();
  for (const group of instances.values()) {
    const first = group[0];
    if (!first || !cohortSessions.has(first.session) || first.page !== d.page) continue;
    const viewRows = group.filter((r) => r.kind === "view");
    requirePageExperience(viewRows.length <= 1, "duplicate-page-view");
    const view = viewRows[0];
    if (!view) continue;
    const key = unit(view);
    viewed.add(key);
    unitKnown.set(
      key,
      (unitKnown.get(key) ?? true) && sessionState.get(view.session) === "complete",
    );
    const afterView = group.filter(
      (r) => pageExperienceTime(r.occurredAt) >= pageExperienceTime(view.occurredAt),
    );
    const content = afterView.find((r) => r.kind === "content" && r.value === d.contentCondition);
    let engagementAt = Infinity;
    if (content) {
      const contentAt = pageExperienceTime(content.occurredAt);
      for (const row of afterView) {
        const at = pageExperienceTime(row.occurredAt);
        if (at < contentAt) continue;
        if (row.kind === "visible")
          requirePageExperience(Number(row.value) <= at - contentAt, "visible-duration");
        if (
          (row.kind === "visible" && Number(row.value) >= d.minVisibleMs) ||
          (row.kind === "action" && d.engagementActions.includes(row.value))
        )
          engagementAt = Math.min(engagementAt, at);
      }
    }
    // A server-confirmed value action also establishes engagement, even when client time is missing.
    const valueRows = afterView.filter((r) => r.kind === "committed" && r.value === d.valueAction);
    for (const row of valueRows) {
      engagementAt = Math.min(engagementAt, pageExperienceTime(row.occurredAt));
      unitEngaged.add(key);
    }
    if (Number.isFinite(engagementAt)) {
      engaged.add(key);
      unitEngaged.add(key);
    }
    const attempt = afterView.find(
      (r) =>
        r.kind === "attempt" &&
        r.value === d.valueAction &&
        pageExperienceTime(r.occurredAt) >= engagementAt,
    );
    if (attempt) {
      attempted.add(key);
      for (const receipt of valueRows.filter(
        (r) => pageExperienceTime(r.occurredAt) >= pageExperienceTime(attempt.occurredAt),
      )) {
        committed.add(key);
        linkedReceipts.add(canonical([receipt.source, receipt.id]));
      }
    }
  }
  for (const key of viewed) {
    if (unitEngaged.has(key)) {
      eligibleBounce.add(key);
      continue;
    }
    if (unitKnown.get(key)) {
      eligibleBounce.add(key);
      bounced.add(key);
    }
  }
  const ratio = (n: number, total: number, unobserved = 0): PageExperienceRatio => ({
    unobserved,
    numerator: n,
    denominator: total,
    value: total && !unobserved ? n / total : null,
  });
  const definitionHash = await hashPageExperience(d),
    inputHash = await hashPageExperience(input);
  return {
    definition: d,
    sourceRef: input.sourceRef,
    sourceRevision: input.sourceRevision,
    snapshotRef: input.snapshotRef,
    definitionHash,
    inputHash,
    window: input.window,
    cutoff: input.cutoff,
    allowedLatenessMs: input.allowedLatenessMs,
    revision: inputHash,
    coverage: input.coverage,
    unit: d.unit,
    viewed: viewed.size,
    engaged: ratio(
      engaged.size,
      viewed.size,
      [...viewed].filter((key) => !engaged.has(key) && !unitKnown.get(key)).length,
    ),
    attempted: ratio(
      attempted.size,
      viewed.size,
      [...viewed].filter((key) => !attempted.has(key) && !unitKnown.get(key)).length,
    ),
    committed: ratio(
      committed.size,
      viewed.size,
      [...viewed].filter((key) => !committed.has(key) && !unitKnown.get(key)).length,
    ),
    confirmedOutcomes: receiptIds.size,
    unlinkedCommitted: [...receiptIds].filter((id) => !linkedReceipts.has(id)).length,
    bounce: ratio(bounced.size, viewed.size, viewed.size - eligibleBounce.size),
    completeSessions,
    openSessions,
    unknownSessions,
    lateRows,
    diagnostics: [
      ...(openSessions ? ["open-sessions"] : []),
      ...(unknownSessions ? ["incomplete-coverage"] : []),
      ...(lateRows ? ["late-rows-excluded"] : []),
    ],
  };
}

export type Ga4EngagementSnapshot = {
  provider: "ga4";
  definitionVersion: string;
  settingsVersion: string;
  sourceRevision: string;
  sessionDenominator: number;
  engagedSessions: number;
  window: { from: string; to: string };
  timezone: string;
  filters: string;
};
/** Keeps GA4's original session denominator and configuration; never applies custom thresholds. */
export function importGa4Engagement(
  input: Ga4EngagementSnapshot,
): Ga4EngagementSnapshot & { bounce: PageExperienceRatio } {
  requirePageExperience(input.provider === "ga4", "provider");
  [input.definitionVersion, input.settingsVersion, input.sourceRevision, input.filters].forEach(
    pageExperienceToken,
  );
  requirePageExperience(
    Number.isSafeInteger(input.sessionDenominator) &&
      Number.isSafeInteger(input.engagedSessions) &&
      input.engagedSessions >= 0 &&
      input.sessionDenominator >= input.engagedSessions,
    "ga4-counts",
  );
  requirePageExperience(
    pageExperienceTime(input.window.from) < pageExperienceTime(input.window.to),
    "window",
  );
  requirePageExperience(
    typeof input.timezone === "string" && input.timezone.length > 0,
    "timezone",
  );
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(0);
  } catch {
    throw new PageExperienceProblem("timezone");
  }
  return {
    ...structuredClone(input),
    bounce: {
      unobserved: 0,
      numerator: input.sessionDenominator - input.engagedSessions,
      denominator: input.sessionDenominator,
      value: input.sessionDenominator
        ? (input.sessionDenominator - input.engagedSessions) / input.sessionDenominator
        : null,
    },
  };
}
