import type {
  LifecycleBillingSummary,
  LifecycleContext,
  LifecycleContextInput,
  LifecycleHealthSummary,
  LifecycleOnboardingSummary,
  LifecycleSignal,
  LifecycleUsageSummary,
} from "./types";

function createSignal(
  input: Omit<LifecycleSignal, "occurredAt"> & { occurredAt?: Date },
): LifecycleSignal {
  return {
    ...input,
    occurredAt: input.occurredAt ?? new Date(),
  };
}

export function createLifecycleContext(input: LifecycleContextInput): LifecycleContext {
  return {
    ...input,
    tenantId: input.tenantId ?? input.signal.tenantId,
    now: input.now ?? new Date(),
  };
}

export function createHealthStatusChangedSignal(input: {
  readonly tenantId: string;
  readonly oldStatus: string;
  readonly newStatus: string;
  readonly score: number;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "health.status.changed",
    tenantId: input.tenantId,
    source: "customer-health",
    occurredAt: input.occurredAt,
    data: {
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      score: input.score,
    },
  });
}

export function createHealthScoreDroppedSignal(input: {
  readonly tenantId: string;
  readonly previousScore: number;
  readonly currentScore: number;
  readonly dropPercentage: number;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "health.score.dropped",
    tenantId: input.tenantId,
    source: "customer-health",
    occurredAt: input.occurredAt,
    data: {
      previousScore: input.previousScore,
      currentScore: input.currentScore,
      dropPercentage: input.dropPercentage,
    },
  });
}

export function createBillingSubscriptionSignal(input: {
  readonly tenantId: string;
  readonly subscription: LifecycleBillingSummary;
  readonly previousStatus?: string;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "billing.subscription.updated",
    tenantId: input.tenantId,
    source: "billing",
    occurredAt: input.occurredAt,
    data: {
      previousStatus: input.previousStatus,
      subscription: input.subscription,
    },
  });
}

export function createBillingPlanChangedSignal(input: {
  readonly tenantId: string;
  readonly previousPlanId?: string;
  readonly currentPlanId: string;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "billing.plan.changed",
    tenantId: input.tenantId,
    source: "billing",
    occurredAt: input.occurredAt,
    data: {
      previousPlanId: input.previousPlanId,
      currentPlanId: input.currentPlanId,
    },
  });
}

export function createMeteringUsageSignal(input: {
  readonly tenantId: string;
  readonly usage: LifecycleUsageSummary;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "metering.usage.recorded",
    tenantId: input.tenantId,
    source: "metering",
    occurredAt: input.occurredAt,
    data: {
      usage: input.usage,
    },
  });
}

export function createMeteringQuotaExceededSignal(input: {
  readonly tenantId: string;
  readonly usage: LifecycleUsageSummary;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "metering.quota.exceeded",
    tenantId: input.tenantId,
    source: "metering",
    occurredAt: input.occurredAt,
    data: {
      usage: input.usage,
    },
  });
}

export function createOnboardingStateSignal(input: {
  readonly tenantId: string;
  readonly onboarding: LifecycleOnboardingSummary;
  readonly signalId?: string;
  readonly occurredAt?: Date;
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "onboarding.state.changed",
    tenantId: input.tenantId,
    source: "onboarding",
    occurredAt: input.occurredAt,
    data: {
      onboarding: input.onboarding,
    },
  });
}

export function createScheduledLifecycleSignal(input: {
  readonly tenantId: string;
  readonly reason: string;
  readonly signalId?: string;
  readonly occurredAt?: Date;
  readonly health?: LifecycleHealthSummary;
  readonly onboarding?: LifecycleOnboardingSummary;
  readonly billing?: LifecycleBillingSummary;
  readonly usage?: readonly LifecycleUsageSummary[];
}): LifecycleSignal {
  return createSignal({
    id: input.signalId,
    type: "scheduled.reevaluation",
    tenantId: input.tenantId,
    source: "scheduler",
    occurredAt: input.occurredAt,
    data: {
      reason: input.reason,
      health: input.health,
      onboarding: input.onboarding,
      billing: input.billing,
      usage: input.usage,
    },
  });
}
