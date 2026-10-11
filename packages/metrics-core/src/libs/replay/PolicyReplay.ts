import { Problem, ProblemCategory } from "@croco/problems-core";

type Scalar = string | number | boolean | null;
export type ReplayPredicate =
  | { readonly op: "all" }
  | { readonly op: "eq" | "neq" | "gte" | "lte"; readonly trait: string; readonly value: Scalar }
  | { readonly op: "and" | "or"; readonly conditions: readonly ReplayPredicate[] }
  | { readonly op: "not"; readonly condition: ReplayPredicate };
export type ReplayScope = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId: string;
  readonly subjectKind: string;
};
export type ReplayScenario = "click-only" | "post-send-inclusive";
export type ReplayRow = {
  readonly subjectId: string;
  readonly atDecision: string;
  readonly traitsAtDecision?: Readonly<Record<string, Scalar>>;
  readonly dispatch?: { readonly dispatchId: string; readonly at: string };
  readonly touchpoints?: readonly { readonly kind: "click"; readonly at: string }[];
  readonly outcomes?: readonly (
    | { readonly kind: "visit"; readonly eventId: string; readonly at: string }
    | {
        readonly kind: "financial";
        readonly eventId: string;
        readonly at: string;
        readonly amount: number;
        readonly currency: string;
      }
  )[];
  readonly cost?: { readonly amount: number; readonly currency: string };
};
export type PolicyReplayInput = {
  readonly scope: ReplayScope;
  readonly snapshotRef: string;
  readonly currency: string;
  readonly unit: string;
  readonly observationWindow: {
    readonly start: string;
    readonly end: string;
    readonly completed: boolean;
  };
  readonly attributionWindowMs: number;
  readonly definition: {
    readonly revision: string;
    readonly existingPredicate: ReplayPredicate;
    readonly newPredicate: ReplayPredicate;
    readonly unknownPolicy: "preserve" | "exclude";
    readonly scenarios: readonly ReplayScenario[];
    readonly changes: readonly ("filter" | "content" | "frequency" | "timing")[];
  };
  readonly rows: readonly ReplayRow[];
};
export type PolicyDiffResult = {
  readonly baselineN: number;
  readonly keptN: number;
  readonly excludedN: number;
  readonly unknownN: number;
  readonly effectiveKeptN: number;
  readonly effectiveExcludedN: number;
  readonly observedCostSaved: {
    readonly status: "available" | "partial" | "unavailable";
    readonly amount: number | null;
    readonly observedDispatchN: number;
    readonly totalDispatchN: number;
    readonly currency: string;
    readonly unit: string;
  };
  readonly observedVisits: {
    readonly preSendN: number;
    readonly postClickN: number;
    readonly postSendNonClickN: number;
    readonly postSendUnknownClickN: number;
  };
  readonly scenarioValues: readonly {
    readonly scenario: ReplayScenario;
    readonly status: "available" | "partial" | "unavailable";
    readonly excludedVisitSubjectN: number;
    readonly excludedFinancialEventN: number;
    readonly excludedObservedRevenue: number;
  }[];
  readonly sourceCoverage: {
    readonly subjectN: number;
    readonly historicalTraitsN: number;
    readonly dispatchN: number;
    readonly observedCostN: number;
    readonly touchpointsN: number;
    readonly outcomesN: number;
  };
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
};
export type PolicyReplayReport = {
  readonly version: 1;
  readonly definitionHash: string;
  readonly inputHash: string;
  readonly input: PolicyReplayInput;
  readonly result: PolicyDiffResult;
};
export class PolicyReplayProblem extends Problem {
  readonly code = "metrics-core/invalid-policy-replay";
  readonly category = ProblemCategory.ValidationError;
  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
function fail(detail: string): never {
  throw new PolicyReplayProblem(detail);
}
function object(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail("Expected a plain JSON object");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))
  )
    fail("Missing or unsupported fields");
}
function string(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim()) fail("Expected a nonempty string");
}
function number(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    fail("Expected a finite nonnegative amount");
}
function array(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) fail("Expected an array");
}
function date(value: unknown): number {
  string(value);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    fail("Expected a canonical ISO UTC timestamp");
  return time;
}
function scalar(value: unknown): asserts value is Scalar {
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "boolean" &&
    (typeof value !== "number" || !Number.isFinite(value))
  )
    fail("Expected a JSON scalar");
}
function predicate(value: unknown, depth = 0): void {
  if (depth > 32) fail("Predicate nesting exceeds 32");
  const p = object(value);
  if (p.op === "all") fields(p, ["op"]);
  else if (p.op === "and" || p.op === "or") {
    fields(p, ["op", "conditions"]);
    array(p.conditions);
    if (!p.conditions.length) fail("Conditions must not be empty");
    p.conditions.forEach((v) => predicate(v, depth + 1));
  } else if (p.op === "not") {
    fields(p, ["op", "condition"]);
    predicate(p.condition, depth + 1);
  } else if (typeof p.op === "string" && ["eq", "neq", "gte", "lte"].includes(p.op)) {
    fields(p, ["op", "trait", "value"]);
    string(p.trait);
    scalar(p.value);
    if ((p.op === "gte" || p.op === "lte") && typeof p.value !== "number")
      fail("Ordered predicates require a number");
  } else fail("Unsupported predicate");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${Array.from(value, canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  scalar(value);
  return JSON.stringify(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function validatePolicyReplayInput(value: unknown): PolicyReplayInput {
  const input = object(value);
  fields(input, [
    "scope",
    "snapshotRef",
    "currency",
    "unit",
    "observationWindow",
    "attributionWindowMs",
    "definition",
    "rows",
  ]);
  const scope = object(input.scope);
  fields(scope, ["appId", "environment", "tenantId", "subjectKind"]);
  Object.values(scope).forEach(string);
  string(input.snapshotRef);
  string(input.currency);
  string(input.unit);
  const window = object(input.observationWindow);
  fields(window, ["start", "end", "completed"]);
  const start = date(window.start),
    end = date(window.end);
  if (start >= end || typeof window.completed !== "boolean") fail("Invalid observation window");
  number(input.attributionWindowMs);
  if (!Number.isSafeInteger(input.attributionWindowMs) || input.attributionWindowMs <= 0)
    fail("Attribution window must be a positive integer");
  const definition = object(input.definition);
  fields(definition, [
    "revision",
    "existingPredicate",
    "newPredicate",
    "unknownPolicy",
    "scenarios",
    "changes",
  ]);
  string(definition.revision);
  predicate(definition.existingPredicate);
  predicate(definition.newPredicate);
  if (
    typeof definition.unknownPolicy !== "string" ||
    !["preserve", "exclude"].includes(definition.unknownPolicy)
  )
    fail("Invalid unknown policy");
  array(definition.scenarios);
  array(definition.changes);
  if (
    !definition.scenarios.length ||
    new Set(definition.scenarios).size !== definition.scenarios.length ||
    definition.scenarios.some(
      (s) => typeof s !== "string" || !["click-only", "post-send-inclusive"].includes(s),
    )
  )
    fail("Invalid scenarios");
  if (
    !definition.changes.length ||
    new Set(definition.changes).size !== definition.changes.length ||
    definition.changes.some(
      (s) => typeof s !== "string" || !["filter", "content", "frequency", "timing"].includes(s),
    )
  )
    fail("Invalid changes");
  array(input.rows);
  const messages = new Set<string>(),
    events = new Map<string, string>(),
    subjects = new Map<string, string>();
  const inWindow = (at: unknown) => {
    const time = date(at);
    if (time < start || time >= end) fail("Event outside observation window");
    return time;
  };
  for (const raw of input.rows) {
    const row = object(raw);
    fields(
      row,
      ["subjectId", "atDecision"],
      ["traitsAtDecision", "dispatch", "cost", "touchpoints", "outcomes"],
    );
    string(row.subjectId);
    const decision = inWindow(row.atDecision);
    if (row.traitsAtDecision !== undefined)
      Object.values(object(row.traitsAtDecision)).forEach(scalar);
    const history = canonical([row.atDecision, row.traitsAtDecision ?? null]);
    if (subjects.has(row.subjectId) && subjects.get(row.subjectId) !== history)
      fail("Conflicting historical subject decisions");
    subjects.set(row.subjectId, history);
    let sent: number | undefined;
    if (row.dispatch !== undefined) {
      const dispatch = object(row.dispatch);
      fields(dispatch, ["dispatchId", "at"]);
      string(dispatch.dispatchId);
      sent = inWindow(dispatch.at);
      if (sent < decision || messages.has(dispatch.dispatchId))
        fail("Invalid or duplicate dispatch");
      messages.add(dispatch.dispatchId);
    }
    if (row.cost !== undefined) {
      const cost = object(row.cost);
      fields(cost, ["amount", "currency"]);
      number(cost.amount);
      if (sent === undefined || cost.currency !== input.currency)
        fail("Cost requires an actual dispatch and matching currency");
    }
    if (row.touchpoints !== undefined) array(row.touchpoints);
    if (row.outcomes !== undefined) array(row.outcomes);
    for (const rawTouch of (row.touchpoints as unknown[] | undefined) ?? []) {
      const touch = object(rawTouch);
      fields(touch, ["kind", "at"]);
      if (touch.kind !== "click" || sent === undefined || inWindow(touch.at) < sent)
        fail("Invalid click sequence");
    }
    for (const rawOutcome of (row.outcomes as unknown[] | undefined) ?? []) {
      const outcome = object(rawOutcome);
      if (outcome.kind === "visit") fields(outcome, ["kind", "eventId", "at"]);
      else if (outcome.kind === "financial") {
        fields(outcome, ["kind", "eventId", "at", "amount", "currency"]);
        number(outcome.amount);
        if (outcome.currency !== input.currency) fail("Outcome currency mismatch");
      } else fail("Unsupported outcome");
      string(outcome.eventId);
      inWindow(outcome.at);
      const identity = canonical({ subjectId: row.subjectId, ...outcome });
      if (events.has(outcome.eventId) && events.get(outcome.eventId) !== identity)
        fail("Conflicting unique outcome event");
      events.set(outcome.eventId, identity);
    }
  }
  return freeze(JSON.parse(canonical(input)) as PolicyReplayInput);
}
function evaluate(p: ReplayPredicate, traits: ReplayRow["traitsAtDecision"]): boolean | undefined {
  if (p.op === "all") return true;
  if (p.op === "not") {
    const result = evaluate(p.condition, traits);
    return result === undefined ? undefined : !result;
  }
  if (p.op === "and" || p.op === "or") {
    const values = p.conditions.map((c) => evaluate(c, traits));
    if (p.op === "and" && values.includes(false)) return false;
    if (p.op === "or" && values.includes(true)) return true;
    return values.includes(undefined) ? undefined : p.op === "and";
  }
  if (!("trait" in p)) return fail("Unsupported predicate");
  if (!traits || !Object.hasOwn(traits, p.trait)) return undefined;
  const value = traits[p.trait];
  if (value !== null && p.value !== null && typeof value !== typeof p.value)
    fail("Historical trait type conflicts with predicate");
  if (p.op === "eq") return value === p.value;
  if (p.op === "neq") return value !== p.value;
  if (typeof value !== "number" || typeof p.value !== "number")
    fail("Historical trait type conflicts with ordered predicate");
  return p.op === "gte" ? value >= p.value : value <= p.value;
}
export function replayPolicy(value: PolicyReplayInput): PolicyDiffResult {
  const input = validatePolicyReplayInput(value);
  const groups = new Map<string, "kept" | "excluded" | "unknown" | "outside">();
  for (const row of input.rows) {
    const before = evaluate(input.definition.existingPredicate, row.traitsAtDecision),
      after = evaluate(input.definition.newPredicate, row.traitsAtDecision);
    groups.set(
      row.subjectId,
      before === false
        ? "outside"
        : before === undefined || after === undefined
          ? "unknown"
          : after
            ? "kept"
            : "excluded",
    );
  }
  const count = (group: string) => [...groups.values()].filter((v) => v === group).length;
  const excluded = (id: string) =>
    groups.get(id) === "excluded" ||
    (groups.get(id) === "unknown" && input.definition.unknownPolicy === "exclude");
  const excludedDispatches = input.rows.filter((row) => excluded(row.subjectId) && row.dispatch);
  const costs = excludedDispatches.flatMap((row) => (row.cost ? [row.cost.amount] : []));
  const visits = new Map<
    string,
    {
      subjectId: string;
      category: "preSendN" | "postClickN" | "postSendNonClickN" | "postSendUnknownClickN";
    }
  >();
  const scenarioValues: PolicyDiffResult["scenarioValues"] = input.definition.scenarios.map(
    (scenario) => {
      const visitSubjects = new Set<string>(),
        financial = new Map<string, number>();
      for (const row of input.rows)
        for (const outcome of row.outcomes ?? []) {
          if (!row.dispatch) continue;
          const at = Date.parse(outcome.at),
            sent = Date.parse(row.dispatch.at);
          const clicked = (row.touchpoints ?? []).some((t) => Date.parse(t.at) <= at);
          const category =
            at < sent
              ? "preSendN"
              : clicked
                ? "postClickN"
                : row.touchpoints === undefined
                  ? "postSendUnknownClickN"
                  : "postSendNonClickN";
          if (outcome.kind === "visit") {
            const previous = visits.get(outcome.eventId);
            const rank = {
              preSendN: 0,
              postSendUnknownClickN: 1,
              postSendNonClickN: 2,
              postClickN: 3,
            };
            if (!previous || rank[category] > rank[previous.category])
              visits.set(outcome.eventId, { subjectId: row.subjectId, category });
          }
          if (
            !excluded(row.subjectId) ||
            at < sent ||
            at - sent > input.attributionWindowMs ||
            (scenario === "click-only" && !clicked)
          )
            continue;
          if (outcome.kind === "visit") visitSubjects.add(row.subjectId);
          else financial.set(outcome.eventId, outcome.amount);
        }
      const evidenceRows = input.rows.filter((row) => excluded(row.subjectId));
      const observed = evidenceRows.filter(
        (row) =>
          row.dispatch &&
          row.outcomes !== undefined &&
          (scenario !== "click-only" || row.touchpoints !== undefined),
      ).length;
      const status = !observed
        ? "unavailable"
        : observed !== evidenceRows.length ||
            !input.observationWindow.completed ||
            evidenceRows.some(
              (row) =>
                row.dispatch &&
                Date.parse(row.dispatch.at) + input.attributionWindowMs >=
                  Date.parse(input.observationWindow.end),
            )
          ? "partial"
          : "available";
      return {
        scenario,
        status,
        excludedVisitSubjectN: visitSubjects.size,
        excludedFinancialEventN: financial.size,
        excludedObservedRevenue: [...financial.values()].reduce((a, b) => a + b, 0),
      };
    },
  );
  const observedVisits = {
    preSendN: 0,
    postClickN: 0,
    postSendNonClickN: 0,
    postSendUnknownClickN: 0,
  };
  for (const category of [
    "preSendN",
    "postClickN",
    "postSendNonClickN",
    "postSendUnknownClickN",
  ] as const)
    observedVisits[category] = new Set(
      [...visits.values()].filter((v) => v.category === category).map((v) => v.subjectId),
    ).size;
  const limitations = [
    "Historical associations do not identify causal increment, revenue loss, or individual counterfactuals.",
    "Single credit per unique event and distinct subject per scenario; fractional multi-touch is unsupported.",
  ];
  if (
    input.rows.some(
      (row) =>
        row.dispatch &&
        Date.parse(row.dispatch.at) + input.attributionWindowMs >=
          Date.parse(input.observationWindow.end),
    )
  )
    limitations.push(
      "Observation does not cover the full dispatch attribution window; scenario values are partial.",
    );
  if (!input.observationWindow.completed)
    limitations.push("Observation window is incomplete; values are partial.");
  if (input.definition.changes.some((c) => c !== "filter"))
    limitations.push(
      "Content, frequency, or timing also changes: this is not a simple filter-removal replay.",
    );
  if (input.rows.some((r) => r.touchpoints === undefined || r.outcomes === undefined))
    limitations.push(
      "Touchpoint or outcome evidence is missing; scenario values cover observed evidence only.",
    );
  if (count("unknown"))
    limitations.push(
      "Missing historical traits remain unknown; current values are never substituted.",
    );
  if (costs.length !== excludedDispatches.length)
    limitations.push("Missing dispatch costs are unavailable and are not imputed as zero.");
  const result: PolicyDiffResult = {
    baselineN: groups.size - count("outside"),
    keptN: count("kept"),
    excludedN: count("excluded"),
    unknownN: count("unknown"),
    effectiveKeptN:
      count("kept") + (input.definition.unknownPolicy === "preserve" ? count("unknown") : 0),
    effectiveExcludedN:
      count("excluded") + (input.definition.unknownPolicy === "exclude" ? count("unknown") : 0),
    observedCostSaved: {
      status: !excludedDispatches.length
        ? "unavailable"
        : costs.length !== excludedDispatches.length
          ? costs.length
            ? "partial"
            : "unavailable"
          : input.observationWindow.completed
            ? "available"
            : "partial",
      amount: !costs.length ? null : costs.reduce((a, b) => a + b, 0),
      observedDispatchN: costs.length,
      totalDispatchN: excludedDispatches.length,
      currency: input.currency,
      unit: input.unit,
    },
    observedVisits,
    scenarioValues,
    sourceCoverage: {
      subjectN: groups.size,
      historicalTraitsN: new Set(
        input.rows.filter((r) => r.traitsAtDecision !== undefined).map((r) => r.subjectId),
      ).size,
      dispatchN: input.rows.filter((r) => r.dispatch).length,
      observedCostN: input.rows.filter((r) => r.cost).length,
      touchpointsN: input.rows.filter((r) => r.touchpoints !== undefined).length,
      outcomesN: input.rows.filter((r) => r.outcomes !== undefined).length,
    },
    assumptions: [
      "Observed dispatch costs are potential savings only if removed sends retain the same unit price.",
      "Click-only requires a click before the outcome; post-send-inclusive credits any outcome after dispatch within the attribution window.",
      "Events use single credit across messages; visit categories prefer post-click, then post-send non-click, then pre-send evidence.",
    ],
    limitations,
  };
  if (
    !Number.isFinite(result.observedCostSaved.amount ?? 0) ||
    result.scenarioValues.some((s) => !Number.isFinite(s.excludedObservedRevenue))
  )
    fail("Aggregate exceeds finite numeric range");
  return freeze(result);
}
async function hash(value: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function createPolicyReplayReport(
  value: PolicyReplayInput,
): Promise<PolicyReplayReport> {
  const input = validatePolicyReplayInput(value),
    result = replayPolicy(input);
  return freeze({
    version: 1,
    definitionHash: await hash({
      definition: input.definition,
      currency: input.currency,
      unit: input.unit,
      observationWindow: input.observationWindow,
      attributionWindowMs: input.attributionWindowMs,
    }),
    inputHash: await hash(input),
    input,
    result,
  });
}
export function serializePolicyReplayReport(report: PolicyReplayReport): string {
  return canonical(report);
}
export async function importPolicyReplayReport(value: unknown): Promise<PolicyReplayReport> {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      fail("Invalid report JSON");
    }
  }
  const report = object(parsed);
  fields(report, ["version", "definitionHash", "inputHash", "input", "result"]);
  const recomputed = await createPolicyReplayReport(validatePolicyReplayInput(report.input));
  if (canonical(report) !== canonical(recomputed))
    fail("Report snapshot or hashes do not match its validated input");
  return recomputed;
}
