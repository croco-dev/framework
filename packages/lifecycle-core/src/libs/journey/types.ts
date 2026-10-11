export type JourneyScope = { appId: string; environment: string; tenantId: string };
export type JourneyReference = { registration: string; params: Readonly<Record<string, unknown>> };
export type JourneyNode =
  | { id: string; kind: "wait"; durationMs: number; next: string }
  | {
      id: string;
      kind: "condition";
      predicate: JourneyReference;
      matched: string;
      unmatched: string;
    }
  | { id: string; kind: "action"; action: JourneyReference; next: string }
  | { id: string; kind: "end" };
export type JourneyDefinition = {
  id: string;
  version: string;
  entry: string;
  goal: JourneyReference;
  reentry: "once" | "episode-key";
  unknownRetryMs: number;
  unknownDeadlineMs: number;
  nodes: readonly JourneyNode[];
};
export type JourneyStatus =
  | "running"
  | "waiting"
  | "paused"
  | "completed"
  | "exited"
  | "failed"
  | "indeterminate";
export type JourneyActionIntent = {
  episodeId: string;
  nodeId: string;
  attemptIdentity: string;
  idempotencyKey: string;
  status: "admitted" | "accepted" | "rejected" | "indeterminate";
  checks: JourneyCheckSnapshot;
  executionReference: string;
  problemCode?: JourneyDispatchProblemCode;
};
export type JourneyReceipt = {
  nodeId: string;
  evaluatedAt: string;
  reason: string;
  sourceEventId: string;
  checks?: JourneyCheckSnapshot;
  executionReference?: string;
  problemCode?: JourneyDispatchProblemCode;
};
export type JourneyCommand = {
  idempotencyKey: string;
  actor: string;
  reason: string;
  expectedRevision: number;
  type: "pause" | "resume" | "stop";
};
export type JourneyReconciliation = {
  idempotencyKey: string;
  actor: string;
  reason: string;
  proofReference: string;
  expectedRevision: number;
  attemptIdentity: string;
  outcome: "accepted" | "rejected";
};
export type JourneyEpisode = {
  id: string;
  scope: JourneyScope;
  subject: string;
  businessObjectRef: string;
  episodeKey: string;
  reentryKey: string;
  sourceEventId: string;
  definitionId: string;
  definitionVersion: string;
  definitionSnapshot: string;
  nodeId: string;
  wakeAt: string | null;
  status: JourneyStatus;
  revision: number;
  startedAt: string;
  unknownSince: string | null;
  unknownSource: string | null;
  reason: string;
  receipts: JourneyReceipt[];
  intents: JourneyActionIntent[];
  commands: JourneyCommand[];
  reconciliations: JourneyReconciliation[];
};
/** Implementations must isolate scope, uniquely create reentryKey, and atomically CAS the complete episode. */
export interface JourneyStore {
  claimDue(
    scope: JourneyScope,
    now: string,
    limit: number,
    leaseMs: number,
  ): Promise<JourneyEpisode[]>;
  create(episode: JourneyEpisode): Promise<{ episode: JourneyEpisode; created: boolean }>;
  get(scope: JourneyScope, id: string): Promise<JourneyEpisode | undefined>;
  list(scope: JourneyScope): Promise<JourneyEpisode[]>;
  compareAndSet(
    scope: JourneyScope,
    id: string,
    expectedRevision: number,
    next: JourneyEpisode,
  ): Promise<boolean>;
}
export type JourneyFacts = {
  goal: boolean | "unknown";
  consent: boolean | "unknown";
  resource: boolean | "unknown";
};
export type JourneyContext = { episode: JourneyEpisode; now: Date };
export type JourneyPredicate = {
  validate(params: Readonly<Record<string, unknown>>): void;
  evaluate(
    context: JourneyContext,
    params: Readonly<Record<string, unknown>>,
  ): Promise<boolean | "unknown">;
};
export type JourneyAction = {
  validate(params: Readonly<Record<string, unknown>>): void;
  capability: string;
  dispatch(
    context: JourneyContext,
    params: Readonly<Record<string, unknown>>,
    intent: JourneyActionIntent,
  ): Promise<"accepted" | "rejected" | "indeterminate">;
};
export type JourneyEngineOptions = {
  store: JourneyStore;
  predicates: Readonly<Record<string, JourneyPredicate>>;
  actions: Readonly<Record<string, JourneyAction>>;
  capabilities: readonly string[];
  checkLatest(context: JourneyContext): Promise<Omit<JourneyFacts, "goal">>;
  now?: () => Date;
};
export type JourneyEntry = Pick<
  JourneyEpisode,
  "id" | "scope" | "subject" | "businessObjectRef" | "episodeKey" | "sourceEventId"
>;

export type JourneyCheckSnapshot = JourneyFacts & { evaluatedAt: string };
export type JourneyDispatchProblemCode =
  | "lifecycle-core/journey-provider-problem"
  | "lifecycle-core/journey-provider-exception"
  | "lifecycle-core/journey-acceptance-unknown";
export type JourneyDryRunStep = {
  nodeId: string;
  kind: JourneyNode["kind"];
  outcome: "wait" | "matched" | "no-match" | "proposed" | "suppressed" | "deferred" | "completed";
  reason: string;
  evaluatedAt: string;
  projectedAt: string;
  checks: JourneyFacts;
  conditionResult?: boolean | "unknown";
  wakeAt?: string;
  deadlineAt?: string;
  deadlineReason?: "blocked-unknown-deadline";
};
export type JourneyDryRunResult = {
  episode: JourneyEpisode;
  goal: boolean | "unknown";
  checks: Omit<JourneyFacts, "goal">;
  nodes: readonly JourneyNode[];
  steps: JourneyDryRunStep[];
};
