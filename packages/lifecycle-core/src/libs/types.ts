export type MonetizationSignalType =
  | "billing.trial.ending"
  | "billing.subscription.past_due"
  | "billing.subscription.recovered"
  | "billing.usage.threshold_crossed"
  | "billing.credit.balance_low"
  | "billing.credit.exhausted"
  | "billing.usage.delivery_lagging"
  | "billing.usage.sync_drifted"
  | "billing.seat.quantity_drifted";

export type MonetizationRecipeId =
  | "monetization.trial-ending-reminder"
  | "monetization.past-due-grace-follow-up"
  | "monetization.usage-80-upgrade-prompt"
  | "monetization.quota-reached-notification"
  | "monetization.low-credit-warning"
  | "monetization.delivery-backlog-escalation"
  | "monetization.usage-drift-escalation"
  | "monetization.seat-drift-escalation";

export type LifecycleSignalType =
  | "health.status.changed"
  | "health.score.dropped"
  | "billing.subscription.updated"
  | "billing.plan.changed"
  | MonetizationSignalType
  | "metering.usage.recorded"
  | "metering.quota.exceeded"
  | "onboarding.state.changed"
  | "onboarding.stalled"
  | "scheduled.reevaluation"
  | (string & {});

export type LifecycleSignal = {
  readonly id?: string;
  readonly type: LifecycleSignalType;
  readonly tenantId: string;
  readonly occurredAt: Date;
  readonly source?: string;
  readonly data?: Record<string, unknown>;
};

export type LifecycleTrigger = {
  readonly type: LifecycleSignalType | "*";
};

export type LifecycleSeverity = "info" | "low" | "medium" | "high" | "critical";

export type LifecycleSubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "revoked"
  | "trialing"
  | (string & {});

export type LifecycleHealthSummary = {
  readonly status?: "healthy" | "at_risk" | "critical" | (string & {});
  readonly score?: number;
  readonly previousScore?: number;
  readonly dropPercentage?: number;
  readonly trend?: string;
  readonly calculatedAt?: Date;
};

export type LifecycleOnboardingSummary = {
  readonly status?: "not_started" | "in_progress" | "completed" | "skipped" | (string & {});
  readonly isCompleted?: boolean;
  readonly currentStepId?: string;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly stalledSince?: Date;
};

export type LifecycleBillingSummary = {
  readonly subscriptionId?: string;
  readonly planId?: string;
  readonly status?: LifecycleSubscriptionStatus;
  readonly currentPeriodEnd?: Date;
  readonly cancelAtPeriodEnd?: boolean;
};

export type LifecycleUsageSummary = {
  readonly meterId: string;
  readonly usage: number;
  readonly quota?: number;
  readonly remaining?: number;
  readonly exceeded?: boolean;
  readonly period?: string;
  readonly metadata?: Record<string, unknown>;
};

export type LifecycleContext = {
  readonly tenantId: string;
  readonly signal: LifecycleSignal;
  readonly now: Date;
  readonly health?: LifecycleHealthSummary;
  readonly onboarding?: LifecycleOnboardingSummary;
  readonly billing?: LifecycleBillingSummary;
  readonly usage?: readonly LifecycleUsageSummary[];
  readonly metadata?: Record<string, unknown>;
};

export type LifecycleContextInput = Omit<LifecycleContext, "tenantId" | "now"> & {
  readonly tenantId?: string;
  readonly now?: Date;
};

export type LifecycleAction = {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly description?: string;
  readonly payload?: Record<string, unknown>;
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
};

export type LifecycleActionStatus = "success" | "failure" | "skipped";

export type LifecycleActionResult = {
  readonly actionId: string;
  readonly type: string;
  readonly status: LifecycleActionStatus;
  readonly message?: string;
  readonly emissionId?: string;
  readonly error?: {
    readonly code?: string;
    readonly message: string;
  };
  readonly metadata?: Record<string, unknown>;
};

export type LifecycleRunStatus = "succeeded" | "failed" | "skipped";

export type LifecycleSkipReason =
  | "condition_not_met"
  | "cooldown_active"
  | "idempotency_key_reused"
  | "rule_not_active"
  | "rule_paused"
  | "rule_unavailable"
  | "no_actions";

export type LifecycleRun = {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly ruleFingerprint: string;
  readonly tenantId: string;
  readonly signalType: LifecycleSignalType;
  readonly signalId?: string;
  readonly severity: LifecycleSeverity;
  readonly status: LifecycleRunStatus;
  readonly idempotencyKey: string;
  readonly skipReason?: LifecycleSkipReason;
  readonly actionResults: readonly LifecycleActionResult[];
  readonly error?: {
    readonly code?: string;
    readonly message: string;
  };
  readonly startedAt: Date;
  readonly completedAt: Date;
};

export type LifecycleRunListOptions = {
  readonly tenantId?: string;
  readonly ruleId?: string;
  readonly limit?: number;
};

export type LifecycleRunClaim = {
  readonly runId: string;
  readonly idempotencyKey: string;
  readonly tenantId: string;
  readonly ruleId: string;
  readonly claimedAt: Date;
  readonly cooldownSince?: Date;
};

export type LifecycleRunClaimResult =
  | { readonly claimed: true }
  | {
      readonly claimed: false;
      readonly reason: "cooldown_active" | "idempotency_key_reused";
    };

export interface LifecycleRunStore {
  /**
   * Atomically reserves an idempotency key and optional cooldown window before dispatch.
   * Distributed adapters must enforce both constraints in one shared transaction.
   */
  claim(claim: LifecycleRunClaim): Promise<LifecycleRunClaimResult>;
  /**
   * Releases an unfinished claim without removing a completed run.
   * Implementations must make this operation idempotent.
   */
  abortClaim(runId: string, idempotencyKey: string): Promise<void>;
  save(run: LifecycleRun): Promise<void>;
  findByIdempotencyKey(idempotencyKey: string): Promise<LifecycleRun | null>;
  findLatestForRule(tenantId: string, ruleId: string, since?: Date): Promise<LifecycleRun | null>;
  list(options?: LifecycleRunListOptions): Promise<readonly LifecycleRun[]>;
}

export type LifecycleIdempotencyResolver = (input: {
  readonly rule: LifecycleRule;
  readonly context: LifecycleContext;
}) => string;

export type LifecycleConditionEvidence = Readonly<Record<string, boolean>>;

export type LifecycleRule = {
  readonly id: string;
  readonly description: string;
  readonly triggers: readonly LifecycleTrigger[];
  readonly severity: LifecycleSeverity;
  readonly cooldown?: {
    readonly durationMs: number;
  };
  readonly idempotencyKey?: LifecycleIdempotencyResolver;
  readonly when?: (context: LifecycleContext) => boolean | Promise<boolean>;
  readonly conditionEvidence?: (
    context: LifecycleContext,
  ) => LifecycleConditionEvidence | Promise<LifecycleConditionEvidence>;
  readonly actions:
    | readonly LifecycleAction[]
    | ((
        context: LifecycleContext,
      ) => readonly LifecycleAction[] | Promise<readonly LifecycleAction[]>);
};

export type LifecycleRuleState =
  | "registered"
  | "inactive"
  | "active"
  | "paused"
  | "superseded"
  | "unavailable";

export type LifecycleRuleActionDescriptor = {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly description?: string;
  readonly configurationFingerprint?: string;
};

export type LifecycleRuleVersionDescriptor = {
  readonly ruleId: string;
  readonly version: string;
  readonly fingerprint: string;
  readonly executableRegistrationId: string;
  readonly executableFingerprint: string;
  readonly description: string;
  readonly triggers: readonly LifecycleTrigger[];
  readonly contextRequirements: readonly string[];
  readonly severity: LifecycleSeverity;
  readonly cooldownDurationMs?: number;
  readonly actions: readonly LifecycleRuleActionDescriptor[];
};

export type LifecycleRuleRegistration = {
  readonly descriptor: LifecycleRuleVersionDescriptor;
  readonly rule: LifecycleRule;
};

export type LifecycleRuleVersionRecord = {
  readonly descriptor: LifecycleRuleVersionDescriptor;
  readonly state: Exclude<LifecycleRuleState, "unavailable">;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
};

export type LifecycleRuleActivationCommandType = "activate" | "pause" | "resume" | "supersede";

export type LifecycleRuleActivationCommand = {
  readonly commandId: string;
  readonly ruleId: string;
  readonly version: string;
  readonly expectedRevision: number;
  readonly actor?: string;
  readonly reason?: string;
  readonly at?: Date;
};

export type LifecycleRuleActivationEvent = {
  readonly commandId: string;
  readonly command: LifecycleRuleActivationCommandType;
  readonly ruleId: string;
  readonly version: string;
  readonly previousState: LifecycleRuleState;
  readonly state: LifecycleRuleState;
  readonly revision: number;
  readonly actor?: string;
  readonly reason?: string;
  readonly occurredAt: Date;
};

export type LifecycleRuleIdentityState = {
  readonly ruleId: string;
  readonly revision: number;
  readonly versions: readonly LifecycleRuleVersionRecord[];
  readonly history: readonly LifecycleRuleActivationEvent[];
};

export type LifecycleRuleStateMutation = {
  readonly state: LifecycleRuleIdentityState;
  readonly replayed: boolean;
};

export type LifecycleRuleStateStoreResult<T> = T | Promise<T>;

export type LifecycleRuleExecutionClaim = {
  readonly claimId: string;
  readonly ruleId: string;
  readonly version: string;
  readonly expiresAt: Date;
};

export type LifecycleRuleExecutionClaimResult =
  | { readonly claimed: true }
  | {
      readonly claimed: false;
      readonly state: LifecycleRuleState | undefined;
    };

export type LifecycleRuleExecutionResult<T> =
  | { readonly executed: true; readonly value: T }
  | {
      readonly executed: false;
      readonly state: LifecycleRuleState | undefined;
    };

export interface LifecycleRuleStateStore {
  get(ruleId: string): LifecycleRuleStateStoreResult<LifecycleRuleIdentityState | undefined>;
  saveRegistration(
    record: LifecycleRuleVersionRecord,
  ): LifecycleRuleStateStoreResult<LifecycleRuleIdentityState>;
  applyCommand(input: {
    readonly command: LifecycleRuleActivationCommandType;
    readonly request: LifecycleRuleActivationCommand;
  }): LifecycleRuleStateStoreResult<LifecycleRuleStateMutation>;
  /**
   * Atomically acquires an execution lease only while the requested version is active.
   * A command that deactivates the version must not complete until its leases are released
   * or expire, and must wake or retry when expiry arrives. Duplicate claim identifiers must
   * be rejected rather than shared.
   */
  claimExecution(
    claim: LifecycleRuleExecutionClaim,
  ): LifecycleRuleStateStoreResult<LifecycleRuleExecutionClaimResult>;
  releaseExecution(claimId: string): LifecycleRuleStateStoreResult<void>;
  list(): LifecycleRuleStateStoreResult<readonly LifecycleRuleIdentityState[]>;
}

export type LifecycleRuleRegistrationInput = {
  readonly rule: LifecycleRule;
  readonly version: string;
  readonly executableRegistrationId: string;
  /**
   * Stable fingerprint of the generated/bundled executable artifact and its captured configuration.
   * This value must change whenever executable rule behavior changes.
   */
  readonly executableFingerprint: string;
  readonly contextRequirements?: readonly string[];
  readonly actionDescriptors?: readonly LifecycleRuleActionDescriptor[];
  readonly activate?: boolean;
  readonly registeredAt?: Date;
};

export type LifecycleRuleInspection = LifecycleRuleVersionDescriptor & {
  readonly state: LifecycleRuleState;
  readonly revision: number;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
};

export type LifecycleDryRunSuppression = {
  readonly suppressed: boolean;
  readonly reason?: LifecycleSkipReason;
};

export type LifecycleDryRunProblem = {
  readonly code: string;
  readonly message: string;
};

export type LifecycleDryRunSignalEvidence = {
  readonly id?: string;
  readonly type: LifecycleSignalType;
  readonly occurredAt: Date;
};

export type LifecycleDryRunResult = {
  readonly tenantId: string;
  readonly signal: LifecycleDryRunSignalEvidence;
  readonly evaluatedAt: Date;
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly ruleFingerprint: string;
  readonly state: LifecycleRuleState;
  readonly matched: boolean;
  readonly conditionEvidence: LifecycleConditionEvidence;
  readonly proposedActions: readonly LifecycleRuleActionDescriptor[];
  readonly suppression: LifecycleDryRunSuppression;
  readonly problems: readonly LifecycleDryRunProblem[];
};

export interface LifecycleDryRunStore {
  save(result: LifecycleDryRunResult): LifecycleRuleStateStoreResult<void>;
  list(options?: {
    readonly ruleId?: string;
    readonly limit?: number;
  }): LifecycleRuleStateStoreResult<readonly LifecycleDryRunResult[]>;
}

export interface LifecycleActionAdapter {
  execute(
    action: LifecycleAction,
    context: LifecycleContext,
    run: Pick<
      LifecycleRun,
      "id" | "idempotencyKey" | "ruleId" | "ruleVersion" | "ruleFingerprint" | "tenantId"
    >,
  ): Promise<LifecycleActionResult>;
}

export type LifecycleEvaluationResult = {
  readonly tenantId: string;
  readonly signal: LifecycleSignal;
  readonly evaluatedAt: Date;
  readonly runs: readonly LifecycleRun[];
};
