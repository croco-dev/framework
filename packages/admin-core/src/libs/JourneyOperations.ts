import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  JourneyCheckSnapshot,
  JourneyDispatchProblemCode,
  JourneyCommand,
  JourneyDefinition,
  JourneyEpisode,
  JourneyScope,
  JourneyStore,
} from "@croco/lifecycle-core";

export type JourneyAdminPermission = "journey.read" | "journey.preview" | "journey.operate";
export type JourneyAdminAccess = Readonly<{
  scope: JourneyScope;
  actor: string;
  permissions: readonly JourneyAdminPermission[];
}>;
export type JourneyEpisodeView = Pick<
  JourneyEpisode,
  "id" | "definitionId" | "definitionVersion" | "nodeId" | "status" | "revision" | "wakeAt"
> & {
  reason: string;
  safeResume: boolean;
  receipts: readonly {
    nodeId: string;
    evaluatedAt: string;
    reason: string;
    checks?: JourneyCheckSnapshot;
    problemCode?: JourneyDispatchProblemCode;
  }[];
  problemCode?: string;
};
export type JourneyDryRunView = Readonly<{ steps: readonly { nodeId: string; outcome: string }[] }>;
export type JourneyAdminState =
  | { kind: "loading" | "empty" }
  | { kind: "denied" | "error"; code: string }
  | { kind: "ready"; episodes: readonly JourneyEpisodeView[] };
export type JourneyAdminCommand = Omit<JourneyCommand, "actor"> & { episodeId: string };
export type JourneyOperationsOptions = {
  /** Resolve the authenticated server session; never bind this to request-supplied grants. */
  authenticate(): Promise<JourneyAdminAccess>;
  store: Pick<JourneyStore, "list">;
  command(scope: JourneyScope, episodeId: string, command: JourneyCommand): Promise<JourneyEpisode>;
  /** Resolve only registered, scope-bound sample IDs and execute without dispatch or persistence. */
  dryRun(
    scope: JourneyScope,
    definition: JourneyDefinition,
    sampleId: string,
  ): Promise<JourneyDryRunView>;
};

export class JourneyAdminProblem extends Problem {
  constructor(detail: string, code: "denied" | "validation" = "denied") {
    super(`journey/admin-${code}`, ProblemCategory.ValidationError, detail);
  }
}

const SAFE_REASONS = new Set([
  "entered",
  "blocked-unknown-deadline",
  "unknown-deferred",
  "goal-achieved",
  "wait-started",
  "wait-finished",
  "matched",
  "no-match",
  "completed",
  "consent-denied",
  "resource-invalid",
  "action-checks",
  "dispatch-admitted",
  "dispatch-accepted",
  "dispatch-rejected",
  "dispatch-indeterminate",
  "dispatch-accepted-after-stop",
  "dispatch-rejected-after-stop",
  "dispatch-indeterminate-after-stop",
  "operator-pause",
  "operator-resume",
  "operator-stop",
  "reconciled-accepted",
  "reconciled-rejected",
]);
function safeReason(reason: string): string {
  return SAFE_REASONS.has(reason) ? reason : "redacted";
}

const SAFE_DISPATCH_PROBLEM_CODES: ReadonlySet<string> = new Set([
  "lifecycle-core/journey-provider-problem",
  "lifecycle-core/journey-provider-exception",
  "lifecycle-core/journey-acceptance-unknown",
]);
function safeProblemCode(
  code: JourneyDispatchProblemCode | undefined,
): JourneyDispatchProblemCode | undefined {
  return code && SAFE_DISPATCH_PROBLEM_CODES.has(code) ? code : undefined;
}

function redact(episode: JourneyEpisode): JourneyEpisodeView {
  return {
    id: episode.id,
    definitionId: episode.definitionId,
    definitionVersion: episode.definitionVersion,
    reason: safeReason(episode.reason),
    safeResume:
      episode.status === "paused" &&
      !episode.intents.some(
        (intent) => intent.status === "admitted" || intent.status === "indeterminate",
      ),
    receipts: episode.receipts.map(({ nodeId, evaluatedAt, reason, checks, problemCode }) => ({
      nodeId,
      evaluatedAt,
      reason: safeReason(reason),
      checks: checks
        ? {
            goal: checks.goal,
            consent: checks.consent,
            resource: checks.resource,
            evaluatedAt: checks.evaluatedAt,
          }
        : undefined,
      problemCode: safeProblemCode(problemCode),
    })),
    problemCode:
      episode.status === "failed" || episode.status === "indeterminate"
        ? (safeProblemCode(episode.receipts.at(-1)?.problemCode) ??
          `journey/${safeReason(episode.reason)}`)
        : undefined,
    nodeId: episode.nodeId,
    status: episode.status,
    revision: episode.revision,
    wakeAt: episode.wakeAt,
  };
}

export class JourneyOperations {
  constructor(private readonly options: JourneyOperationsOptions) {}

  private async access(
    scope: JourneyScope,
    permission: JourneyAdminPermission,
  ): Promise<JourneyAdminAccess> {
    const access = await this.options.authenticate();
    if (
      !scope.tenantId?.trim() ||
      !scope.appId?.trim() ||
      !scope.environment?.trim() ||
      !access.scope.tenantId?.trim() ||
      !access.scope.appId?.trim() ||
      !access.scope.environment?.trim() ||
      !access.actor?.trim() ||
      !access.permissions.includes(permission) ||
      access.scope.tenantId !== scope.tenantId ||
      access.scope.appId !== scope.appId ||
      access.scope.environment !== scope.environment
    ) {
      throw new JourneyAdminProblem("Journey scope or permission denied");
    }
    return access;
  }

  async list(scope: JourneyScope): Promise<readonly JourneyEpisodeView[]> {
    await this.access(scope, "journey.read");
    const episodes = await this.options.store.list(scope);
    if (
      episodes.some(
        (episode) =>
          episode.scope.tenantId !== scope.tenantId ||
          episode.scope.appId !== scope.appId ||
          episode.scope.environment !== scope.environment,
      )
    ) {
      throw new JourneyAdminProblem("Journey store returned an out-of-scope episode");
    }
    return episodes.map(redact);
  }

  async dryRun(
    scope: JourneyScope,
    definition: JourneyDefinition,
    sampleId: string,
  ): Promise<JourneyDryRunView> {
    await this.access(scope, "journey.preview");
    if (!sampleId.trim())
      throw new JourneyAdminProblem("Registered sample is required", "validation");
    const result = await this.options.dryRun(scope, definition, sampleId);
    return { steps: result.steps.map(({ nodeId, outcome }) => ({ nodeId, outcome })) };
  }

  async command(scope: JourneyScope, input: JourneyAdminCommand): Promise<JourneyEpisodeView> {
    const access = await this.access(scope, "journey.operate");
    if (
      !input.episodeId.trim() ||
      !input.reason.trim() ||
      !input.idempotencyKey.trim() ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      !["pause", "resume", "stop"].includes(input.type)
    ) {
      throw new JourneyAdminProblem(
        "Episode, command, revision, audit reason and idempotency key are required",
        "validation",
      );
    }
    const episode = await this.options.command(scope, input.episodeId, {
      type: input.type,
      actor: access.actor,
      reason: input.reason,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
    });
    return redact(episode);
  }
}
