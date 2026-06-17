export type LifecycleSignalType =
  | "health.status.changed"
  | "health.score.dropped"
  | "billing.subscription.updated"
  | "billing.plan.changed"
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
  | "no_actions";

export type LifecycleRun = {
  readonly id: string;
  readonly ruleId: string;
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

export interface LifecycleRunStore {
  save(run: LifecycleRun): Promise<void>;
  findByIdempotencyKey(idempotencyKey: string): Promise<LifecycleRun | null>;
  findLatestForRule(tenantId: string, ruleId: string, since?: Date): Promise<LifecycleRun | null>;
  list(options?: LifecycleRunListOptions): Promise<readonly LifecycleRun[]>;
}

export type LifecycleIdempotencyResolver = (input: {
  readonly rule: LifecycleRule;
  readonly context: LifecycleContext;
}) => string;

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
  readonly actions:
    | readonly LifecycleAction[]
    | ((
        context: LifecycleContext,
      ) => readonly LifecycleAction[] | Promise<readonly LifecycleAction[]>);
};

export interface LifecycleActionAdapter {
  execute(
    action: LifecycleAction,
    context: LifecycleContext,
    run: Pick<LifecycleRun, "id" | "idempotencyKey" | "ruleId" | "tenantId">,
  ): Promise<LifecycleActionResult>;
}

export type LifecycleEvaluationResult = {
  readonly tenantId: string;
  readonly signal: LifecycleSignal;
  readonly evaluatedAt: Date;
  readonly runs: readonly LifecycleRun[];
};
