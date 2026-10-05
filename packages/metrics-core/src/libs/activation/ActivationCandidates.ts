import { Problem, ProblemCategory } from "@croco/problems-core";

export type ActivationWindow = {
  readonly id: string;
  readonly fromMs: number;
  readonly toMs: number;
};
export type ActivationOutcomeWindow = { readonly fromMs: number; readonly toMs: number };
export type ActivationCandidate = {
  readonly id: string;
  readonly actionId: string;
  readonly windowId: string;
  readonly threshold: number;
  readonly countMode: "frequency" | "activeDays";
};
export type ActivationDefinition = {
  readonly id: string;
  readonly version: number;
  readonly subjectKind: "user" | "account";
  readonly cohortPolicy: "new" | "returning" | "separate";
  readonly timezone: string;
  readonly unit: string;
  readonly sourceRevisions: Readonly<Record<string, string>>;
  readonly sourceRunRef: string;
  readonly windows: readonly ActivationWindow[];
  readonly outcomeWindow: ActivationOutcomeWindow;
  readonly candidates: readonly ActivationCandidate[];
  readonly minSupport: number;
  readonly maxRows: number;
  readonly maxCandidates: number;
};
export type ActivationRow = {
  readonly subjectId: string;
  readonly anchorAt: string;
  readonly cohort: "new" | "returning";
  readonly actionCountsByWindow?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly activeDaysByWindow?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly outcome: boolean | null;
  readonly outcomeWindow: ActivationOutcomeWindow;
  readonly completeThrough: string;
  readonly achievementAtByCandidate?: Readonly<Record<string, string>>;
};
export type ActivationRatio = {
  readonly value: number | null;
  readonly zeroDenominatorReason: string | null;
};
export type ActivationCandidateResult = {
  readonly candidate: ActivationCandidate;
  readonly cohort: "new" | "returning";
  readonly eligibleN: number;
  readonly DO: number;
  readonly RE: number;
  readonly NO: number;
  readonly support: ActivationRatio;
  readonly passesMinSupport: boolean;
  readonly precision: ActivationRatio;
  readonly coverage: ActivationRatio;
  readonly noRedo: ActivationRatio;
  readonly excluded: Readonly<
    Record<"cohort" | "missingOutcome" | "incompleteObservation" | "missingCount", number>
  >;
  readonly achievementCurve:
    | {
        readonly status: "unsupported";
        readonly reason: "missingVerifiedAchievementTimes" | "noAchievedSubjects";
      }
    | {
        readonly status: "available";
        readonly points: readonly {
          readonly elapsedMs: number;
          readonly achieved: number;
          readonly fraction: number;
        }[];
      };
};
export type ActivationReport = {
  readonly definition: ActivationDefinition;
  readonly rowCount: number;
  readonly candidates: readonly ActivationCandidateResult[];
};
export class ActivationValidationProblem extends Problem {
  readonly code = "metrics-core/invalid-activation-input";
  readonly category = ProblemCategory.ValidationError;
  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

function requireValid(condition: boolean, detail: string): asserts condition {
  if (!condition) throw new ActivationValidationProblem(detail);
}
function integer(value: number, field: string, minimum = 0): void {
  requireValid(
    Number.isSafeInteger(value) && value >= minimum,
    `${field} must be a safe integer >= ${minimum}`,
  );
}
function instant(value: string, field: string): number {
  const time = Date.parse(value);
  requireValid(
    Number.isFinite(time) && new Date(time).toISOString() === value,
    `${field} must be a canonical UTC ISO timestamp`,
  );
  return time;
}
function text(value: string, field: string): void {
  requireValid(typeof value === "string" && value.trim().length > 0, `${field} is required`);
}
function validateWindow(window: ActivationOutcomeWindow): void {
  integer(window.fromMs, "window.fromMs");
  integer(window.toMs, "window.toMs", 1);
  requireValid(window.fromMs < window.toMs, "window must be a nonempty [fromMs,toMs) interval");
}
function validate(rows: readonly ActivationRow[], definition: ActivationDefinition): void {
  text(definition.id, "id");
  integer(definition.version, "version", 1);
  text(definition.unit, "unit");
  text(definition.sourceRunRef, "sourceRunRef");
  requireValid(Object.keys(definition.sourceRevisions).length > 0, "sourceRevisions is required");
  for (const [source, revision] of Object.entries(definition.sourceRevisions)) {
    text(source, "source");
    text(revision, "revision");
  }
  requireValid(["user", "account"].includes(definition.subjectKind), "invalid subjectKind");
  requireValid(
    ["new", "returning", "separate"].includes(definition.cohortPolicy),
    "invalid cohortPolicy",
  );
  text(definition.timezone, "timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: definition.timezone });
  } catch {
    throw new ActivationValidationProblem("timezone must be an IANA time zone");
  }
  integer(definition.maxRows, "maxRows", 1);
  integer(definition.maxCandidates, "maxCandidates", 1);
  requireValid(rows.length <= definition.maxRows, "maxRows exceeded");
  requireValid(
    definition.candidates.length > 0 && definition.candidates.length <= definition.maxCandidates,
    "candidate count must be positive and <= maxCandidates",
  );
  requireValid(
    Number.isFinite(definition.minSupport) &&
      definition.minSupport >= 0 &&
      definition.minSupport <= 1,
    "minSupport must be in [0,1]",
  );
  validateWindow(definition.outcomeWindow);
  const windows = new Map<string, ActivationWindow>();
  for (const window of definition.windows) {
    text(window.id, "window.id");
    validateWindow(window);
    requireValid(!windows.has(window.id), "duplicate window id");
    requireValid(
      window.toMs <= definition.outcomeWindow.fromMs,
      "action windows must end before the outcome window",
    );
    windows.set(window.id, window);
  }
  const candidates = new Map<string, ActivationCandidate>();
  for (const candidate of definition.candidates) {
    text(candidate.id, "candidate.id");
    text(candidate.actionId, "actionId");
    requireValid(!candidates.has(candidate.id), "duplicate candidate id");
    requireValid(windows.has(candidate.windowId), "unknown candidate window");
    requireValid(["frequency", "activeDays"].includes(candidate.countMode), "invalid countMode");
    integer(candidate.threshold, "threshold", 1);
    candidates.set(candidate.id, candidate);
  }
  const subjects = new Set<string>();
  for (const row of rows) {
    text(row.subjectId, "subjectId");
    requireValid(!subjects.has(row.subjectId), "duplicate subject or ambiguous subject cohort");
    subjects.add(row.subjectId);
    requireValid(["new", "returning"].includes(row.cohort), "invalid row cohort");
    const anchor = instant(row.anchorAt, "anchorAt");
    const complete = instant(row.completeThrough, "completeThrough");
    requireValid(complete >= anchor, "completeThrough precedes anchorAt");
    requireValid(
      Number.isSafeInteger(anchor + definition.outcomeWindow.toMs) &&
        Math.abs(anchor + definition.outcomeWindow.toMs) <= 8640000000000000,
      "outcome end exceeds timestamp range",
    );
    requireValid(
      row.outcome === null || row.outcome === undefined || typeof row.outcome === "boolean",
      "outcome must be boolean or null",
    );
    requireValid(
      row.outcomeWindow.fromMs === definition.outcomeWindow.fromMs &&
        row.outcomeWindow.toMs === definition.outcomeWindow.toMs,
      "row outcome window differs from definition",
    );
    for (const counts of [row.actionCountsByWindow, row.activeDaysByWindow]) {
      if (!counts) continue;
      for (const [windowId, actions] of Object.entries(counts)) {
        requireValid(windows.has(windowId), "unknown count window");
        for (const [action, value] of Object.entries(actions)) {
          text(action, "action");
          integer(value, "count");
        }
      }
    }
    for (const [id, value] of Object.entries(row.achievementAtByCandidate ?? {})) {
      const candidate = candidates.get(id);
      requireValid(candidate !== undefined, "unknown achievement candidate");
      const window = windows.get(candidate.windowId);
      requireValid(window !== undefined, "unknown achievement window");
      const at = instant(value, "achievementAtByCandidate");
      requireValid(
        at >= anchor + window.fromMs && at < anchor + window.toMs && at <= complete,
        "achievement timestamp outside observed action window",
      );
      const count = countFor(row, candidate);
      requireValid(
        count !== undefined && count >= candidate.threshold,
        "achievement timestamp contradicts candidate threshold",
      );
    }
  }
}
function countFor(row: ActivationRow, candidate: ActivationCandidate): number | undefined {
  const counts =
    candidate.countMode === "frequency" ? row.actionCountsByWindow : row.activeDaysByWindow;
  if (!counts || !Object.hasOwn(counts, candidate.windowId)) return undefined;
  const actions = counts[candidate.windowId];
  return actions && Object.hasOwn(actions, candidate.actionId)
    ? actions[candidate.actionId]
    : undefined;
}
function ratio(numerator: number, denominator: number, reason: string): ActivationRatio {
  return denominator === 0
    ? { value: null, zeroDenominatorReason: reason }
    : { value: numerator / denominator, zeroDenominatorReason: null };
}

export function calculateActivationCandidates(
  rows: readonly ActivationRow[],
  definition: ActivationDefinition,
): ActivationReport {
  validate(rows, definition);
  const cohorts: readonly ("new" | "returning")[] =
    definition.cohortPolicy === "separate" ? ["new", "returning"] : [definition.cohortPolicy];
  const results: ActivationCandidateResult[] = [];
  for (const candidate of definition.candidates)
    for (const cohort of cohorts) {
      let eligibleN = 0;
      let DO = 0;
      let RE = 0;
      let NO = 0;
      const excluded = { cohort: 0, missingOutcome: 0, incompleteObservation: 0, missingCount: 0 };
      const achievementTimes: number[] = [];
      for (const row of rows) {
        if (row.cohort !== cohort) {
          excluded.cohort++;
          continue;
        }
        if (row.outcome === null || row.outcome === undefined) {
          excluded.missingOutcome++;
          continue;
        }
        if (
          Date.parse(row.completeThrough) <
          Date.parse(row.anchorAt) + definition.outcomeWindow.toMs
        ) {
          excluded.incompleteObservation++;
          continue;
        }
        const count = countFor(row, candidate);
        if (count === undefined) {
          excluded.missingCount++;
          continue;
        }
        eligibleN++;
        if (count >= candidate.threshold) {
          DO++;
          if (row.outcome) RE++;
          const at = row.achievementAtByCandidate?.[candidate.id];
          if (at !== undefined) achievementTimes.push(Date.parse(at) - Date.parse(row.anchorAt));
        } else if (row.outcome) NO++;
      }
      const support = ratio(DO, eligibleN, "noEligibleSubjects");
      let achievementCurve: ActivationCandidateResult["achievementCurve"];
      if (DO === 0) achievementCurve = { status: "unsupported", reason: "noAchievedSubjects" };
      else if (achievementTimes.length !== DO)
        achievementCurve = { status: "unsupported", reason: "missingVerifiedAchievementTimes" };
      else {
        achievementTimes.sort((a, b) => a - b);
        const points: { elapsedMs: number; achieved: number; fraction: number }[] = [];
        achievementTimes.forEach((elapsedMs, index) => {
          if (achievementTimes[index + 1] !== elapsedMs)
            points.push({ elapsedMs, achieved: index + 1, fraction: (index + 1) / eligibleN });
        });
        achievementCurve = { status: "available", points };
      }
      results.push({
        candidate,
        cohort,
        eligibleN,
        DO,
        RE,
        NO,
        support,
        passesMinSupport: support.value !== null && support.value >= definition.minSupport,
        precision: ratio(RE, DO, "noAchievedSubjects"),
        coverage: ratio(RE, RE + NO, "noRetainedSubjects"),
        noRedo: ratio(RE, NO + DO, "noAchievedOrUncapturedRetainedSubjects"),
        excluded,
        achievementCurve,
      });
    }
  return { definition, rowCount: rows.length, candidates: results };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    requireValid(encoded !== undefined, "hash input must be JSON serializable");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(",")}}`;
}
export async function hashActivationInputs(
  rows: readonly ActivationRow[],
  definition: ActivationDefinition,
): Promise<{ inputHash: string; definitionHash: string }> {
  validate(rows, definition);
  const digest = async (value: unknown): Promise<string> => {
    const bytes = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical(value)),
    );
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const [inputHash, definitionHash] = await Promise.all([
    digest(
      [...rows].sort((a, b) =>
        a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0,
      ),
    ),
    digest(definition),
  ]);
  return { inputHash, definitionHash };
}
