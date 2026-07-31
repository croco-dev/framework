import { createHash } from "node:crypto";
import type { PlanVersionRef } from "@croco/billing-core";
import {
  MonetizationRecipeCapabilityProblem,
  MonetizationSignalDefinitionProblem,
  MonetizationThresholdClaimProblem,
} from "./problems/LifecycleProblems";
import type { LifecycleRuleRegistry } from "./LifecycleRuleRegistry";
import type {
  LifecycleAction,
  LifecycleRuleActionDescriptor,
  LifecycleRuleRegistration,
  LifecycleRuleRegistrationInput,
  LifecycleSignal,
  MonetizationRecipeId,
  MonetizationSignalType,
} from "./types";

export type { MonetizationRecipeId, MonetizationSignalType } from "./types";

export type MonetizationSignalReason =
  | "trial_end_approaching"
  | "payment_failed"
  | "payment_action_required"
  | "subscription_recovered"
  | "usage_threshold_crossed"
  | "credit_balance_low"
  | "credit_exhausted"
  | "delivery_backlog"
  | "usage_mismatch"
  | "seat_quantity_mismatch";

export type MonetizationSafeEvidence = Readonly<Record<string, string | number | boolean | null>>;

export type MonetizationSignalEvidenceByType = {
  readonly "billing.trial.ending": {
    readonly trialEndsAt: string;
    readonly daysRemaining: number;
  };
  readonly "billing.subscription.past_due": { readonly attemptCount: number };
  readonly "billing.subscription.recovered": { readonly recovered: boolean };
  readonly "billing.usage.threshold_crossed": {
    readonly meterKey: string;
    readonly threshold: number;
    readonly consumed: number;
    readonly limit: number;
    readonly ratio: number;
    readonly periodStartsAt: string;
    readonly periodEndsAt: string;
  };
  readonly "billing.credit.balance_low": {
    readonly balance: number;
    readonly threshold: number;
    readonly unit: string;
  };
  readonly "billing.credit.exhausted": {
    readonly balance: number;
    readonly unit: string;
  };
  readonly "billing.usage.delivery_lagging": {
    readonly meterKey: string;
    readonly pendingRecordCount: number;
    readonly oldestPendingAt: string;
    readonly periodEndsAt: string;
  };
  readonly "billing.usage.sync_drifted": {
    readonly meterKey: string;
    readonly localRecorded: number;
    readonly upstreamObserved: number;
    readonly difference: number;
    readonly tolerance: number;
    readonly periodStartsAt: string;
    readonly periodEndsAt: string;
  };
  readonly "billing.seat.quantity_drifted": {
    readonly expectedQuantity: number;
    readonly observedQuantity: number;
    readonly difference: number;
  };
};

export type MonetizationSignalDescriptor = {
  readonly id: string;
  readonly type: MonetizationSignalType;
  readonly schemaVersion: "1";
  readonly description: string;
  readonly planVersionRequired: boolean;
  readonly recoveryType?: MonetizationSignalType;
};

export type MonetizationSignalMetadataByType = {
  readonly "billing.trial.ending": {
    readonly reason: "trial_end_approaching";
    readonly status: "ending";
    readonly planVersionRef: PlanVersionRef;
  };
  readonly "billing.subscription.past_due": {
    readonly reason: "payment_failed" | "payment_action_required";
    readonly status: "past_due";
    readonly planVersionRef: PlanVersionRef;
    readonly conditionId: string;
  };
  readonly "billing.subscription.recovered": {
    readonly reason: "subscription_recovered";
    readonly status: "recovered";
    readonly planVersionRef: PlanVersionRef;
    readonly conditionId: string;
    readonly recoveryOf: string;
  };
  readonly "billing.usage.threshold_crossed": {
    readonly reason: "usage_threshold_crossed";
    readonly status: "crossed";
    readonly planVersionRef: PlanVersionRef;
  };
  readonly "billing.credit.balance_low": {
    readonly reason: "credit_balance_low";
    readonly status: "low";
    readonly planVersionRef?: PlanVersionRef;
    readonly conditionId: string;
  };
  readonly "billing.credit.exhausted": {
    readonly reason: "credit_exhausted";
    readonly status: "exhausted";
    readonly planVersionRef?: PlanVersionRef;
    readonly conditionId: string;
  };
  readonly "billing.usage.delivery_lagging": {
    readonly reason: "delivery_backlog";
    readonly status: "lagging";
    readonly planVersionRef: PlanVersionRef;
    readonly conditionId: string;
  };
  readonly "billing.usage.sync_drifted": {
    readonly reason: "usage_mismatch";
    readonly status: "drifted";
    readonly planVersionRef: PlanVersionRef;
    readonly conditionId: string;
  };
  readonly "billing.seat.quantity_drifted": {
    readonly reason: "seat_quantity_mismatch";
    readonly status: "drifted";
    readonly planVersionRef: PlanVersionRef;
    readonly conditionId: string;
  };
};

export type MonetizationSignalData<TType extends MonetizationSignalType = MonetizationSignalType> =
  {
    readonly effectiveAt: string;
    readonly sourceAt: string;
    readonly evidence: MonetizationSignalEvidenceByType[TType];
  } & MonetizationSignalMetadataByType[TType];

export type MonetizationLifecycleSignal<
  TType extends MonetizationSignalType = MonetizationSignalType,
> = TType extends MonetizationSignalType
  ? LifecycleSignal & {
      readonly id: string;
      readonly type: TType;
      readonly source: "monetization";
      readonly data: MonetizationSignalData<TType>;
    }
  : never;

type SignalInput = {
  readonly tenantId: string;
  readonly effectiveAt: Date;
  readonly sourceAt: Date;
};

type PlanSignalInput = SignalInput & {
  readonly planVersionRef: PlanVersionRef;
};

export type TrialEndingSignalInput = PlanSignalInput & {
  readonly trialEndsAt: Date;
  readonly daysRemaining: number;
};

export type SubscriptionPastDueSignalInput = PlanSignalInput & {
  readonly conditionId: string;
  readonly reason: "payment_failed" | "payment_action_required";
  readonly attemptCount?: number;
};

export type SubscriptionRecoveredSignalInput = PlanSignalInput & {
  readonly conditionId: string;
  readonly recoveredConditionId: string;
};

export type UsageThresholdCrossedSignalInput = PlanSignalInput & {
  readonly meterKey: string;
  readonly threshold: number;
  readonly consumed: number;
  readonly limit: number;
  readonly periodStartsAt: Date;
  readonly periodEndsAt: Date;
};

export type CreditBalanceLowSignalInput = SignalInput & {
  readonly conditionId: string;
  readonly balance: number;
  readonly threshold: number;
  readonly unit: string;
  readonly planVersionRef?: PlanVersionRef;
};

export type CreditExhaustedSignalInput = SignalInput & {
  readonly conditionId: string;
  readonly balance: number;
  readonly unit: string;
  readonly planVersionRef?: PlanVersionRef;
};

export type UsageDeliveryLaggingSignalInput = PlanSignalInput & {
  readonly conditionId: string;
  readonly meterKey: string;
  readonly pendingRecordCount: number;
  readonly oldestPendingAt: Date;
  readonly periodEndsAt: Date;
};

export type UsageSyncDriftedSignalInput = PlanSignalInput & {
  readonly conditionId: string;
  readonly meterKey: string;
  readonly localRecorded: number;
  readonly upstreamObserved: number;
  readonly tolerance: number;
  readonly periodStartsAt: Date;
  readonly periodEndsAt: Date;
};

export type SeatQuantityDriftedSignalInput = PlanSignalInput & {
  readonly conditionId: string;
  readonly expectedQuantity: number;
  readonly observedQuantity: number;
};

const SIGNAL_DESCRIPTORS = [
  {
    id: "trial-ending",
    type: "billing.trial.ending",
    schemaVersion: "1",
    description: "A subscription trial is approaching its effective end.",
    planVersionRequired: true,
  },
  {
    id: "subscription-past-due",
    type: "billing.subscription.past_due",
    schemaVersion: "1",
    description: "A subscription entered a provider-neutral delinquency condition.",
    planVersionRequired: true,
    recoveryType: "billing.subscription.recovered",
  },
  {
    id: "subscription-recovered",
    type: "billing.subscription.recovered",
    schemaVersion: "1",
    description: "A subscription recovered from a correlated delinquency condition.",
    planVersionRequired: true,
  },
  {
    id: "usage-threshold-crossed",
    type: "billing.usage.threshold_crossed",
    schemaVersion: "1",
    description: "Usage crossed one configured threshold within a plan and billing period.",
    planVersionRequired: true,
  },
  {
    id: "credit-balance-low",
    type: "billing.credit.balance_low",
    schemaVersion: "1",
    description: "A provider-neutral credit balance reached a configured low level.",
    planVersionRequired: false,
  },
  {
    id: "credit-exhausted",
    type: "billing.credit.exhausted",
    schemaVersion: "1",
    description: "A provider-neutral credit balance was exhausted.",
    planVersionRequired: false,
  },
  {
    id: "usage-delivery-lagging",
    type: "billing.usage.delivery_lagging",
    schemaVersion: "1",
    description: "Billable usage delivery is lagging before period close.",
    planVersionRequired: true,
  },
  {
    id: "usage-sync-drifted",
    type: "billing.usage.sync_drifted",
    schemaVersion: "1",
    description: "Local and upstream usage totals differ beyond an accepted tolerance.",
    planVersionRequired: true,
  },
  {
    id: "seat-quantity-drifted",
    type: "billing.seat.quantity_drifted",
    schemaVersion: "1",
    description: "Expected and observed licensed seat quantities differ.",
    planVersionRequired: true,
  },
] as const satisfies readonly MonetizationSignalDescriptor[];

export const MONETIZATION_SIGNAL_DESCRIPTORS: readonly MonetizationSignalDescriptor[] =
  SIGNAL_DESCRIPTORS;

function assertNonEmpty(signalType: MonetizationSignalType, field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new MonetizationSignalDefinitionProblem(signalType, `${field} must not be empty`);
  }
}

function assertFinite(
  signalType: MonetizationSignalType,
  field: string,
  value: number,
  minimum = 0,
): void {
  if (!Number.isFinite(value) || value < minimum) {
    throw new MonetizationSignalDefinitionProblem(
      signalType,
      `${field} must be a finite number greater than or equal to ${String(minimum)}`,
    );
  }
}

function assertValidDate(signalType: MonetizationSignalType, field: string, value: Date): void {
  if (!Number.isFinite(value.getTime())) {
    throw new MonetizationSignalDefinitionProblem(signalType, `${field} must be a valid date`);
  }
}

function assertPeriod(signalType: MonetizationSignalType, startsAt: Date, endsAt: Date): void {
  assertValidDate(signalType, "periodStartsAt", startsAt);
  assertValidDate(signalType, "periodEndsAt", endsAt);
  if (startsAt >= endsAt) {
    throw new MonetizationSignalDefinitionProblem(
      signalType,
      "periodStartsAt must be before periodEndsAt",
    );
  }
}

function assertSignalInput(signalType: MonetizationSignalType, input: SignalInput): void {
  assertNonEmpty(signalType, "tenantId", input.tenantId);
  assertValidDate(signalType, "effectiveAt", input.effectiveAt);
  assertValidDate(signalType, "sourceAt", input.sourceAt);
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function deterministicId(type: MonetizationSignalType, material: Record<string, unknown>): string {
  return `${type}:${createHash("sha256")
    .update(JSON.stringify(canonicalize(material)))
    .digest("hex")}`;
}

function createMonetizationSignal<TType extends MonetizationSignalType>(
  input: SignalInput,
  type: TType,
  data: MonetizationSignalData<TType>,
  identityMaterial: Record<string, unknown>,
): MonetizationLifecycleSignal<TType> {
  assertNonEmpty(type, "tenantId", input.tenantId);
  assertValidDate(type, "effectiveAt", input.effectiveAt);
  assertValidDate(type, "sourceAt", input.sourceAt);
  const signal = {
    id: deterministicId(type, {
      tenantId: input.tenantId,
      ...identityMaterial,
    }),
    type,
    tenantId: input.tenantId,
    occurredAt: new Date(input.effectiveAt),
    source: "monetization",
    data,
  };
  return signal as unknown as MonetizationLifecycleSignal<TType>;
}

function baseData<TType extends MonetizationSignalType>(
  _type: TType,
  input: SignalInput & { readonly planVersionRef?: PlanVersionRef },
  reason: MonetizationSignalData<TType>["reason"],
  status: MonetizationSignalData<TType>["status"],
  evidence: MonetizationSignalEvidenceByType[TType],
  correlation?: { readonly conditionId?: string; readonly recoveryOf?: string },
): MonetizationSignalData<TType> {
  return {
    effectiveAt: input.effectiveAt.toISOString(),
    sourceAt: input.sourceAt.toISOString(),
    reason,
    status,
    planVersionRef: input.planVersionRef,
    conditionId: correlation?.conditionId,
    recoveryOf: correlation?.recoveryOf,
    evidence,
  } as unknown as MonetizationSignalData<TType>;
}

export function createTrialEndingSignal(
  input: TrialEndingSignalInput,
): MonetizationLifecycleSignal<"billing.trial.ending"> {
  assertSignalInput("billing.trial.ending", input);
  assertFinite("billing.trial.ending", "daysRemaining", input.daysRemaining);
  assertValidDate("billing.trial.ending", "trialEndsAt", input.trialEndsAt);
  const data = baseData("billing.trial.ending", input, "trial_end_approaching", "ending", {
    trialEndsAt: input.trialEndsAt.toISOString(),
    daysRemaining: input.daysRemaining,
  });
  return createMonetizationSignal(input, "billing.trial.ending", data, {
    planVersionRef: input.planVersionRef,
    trialEndsAt: input.trialEndsAt,
    daysRemaining: input.daysRemaining,
  });
}

export function createSubscriptionPastDueSignal(
  input: SubscriptionPastDueSignalInput,
): MonetizationLifecycleSignal<"billing.subscription.past_due"> {
  assertSignalInput("billing.subscription.past_due", input);
  assertNonEmpty("billing.subscription.past_due", "conditionId", input.conditionId);
  if (input.attemptCount !== undefined) {
    assertFinite("billing.subscription.past_due", "attemptCount", input.attemptCount);
  }
  const data = baseData(
    "billing.subscription.past_due",
    input,
    input.reason,
    "past_due",
    { attemptCount: input.attemptCount ?? 0 },
    { conditionId: input.conditionId },
  );
  return createMonetizationSignal(input, "billing.subscription.past_due", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
  });
}

export function createSubscriptionRecoveredSignal(
  input: SubscriptionRecoveredSignalInput,
): MonetizationLifecycleSignal<"billing.subscription.recovered"> {
  assertSignalInput("billing.subscription.recovered", input);
  assertNonEmpty("billing.subscription.recovered", "conditionId", input.conditionId);
  assertNonEmpty(
    "billing.subscription.recovered",
    "recoveredConditionId",
    input.recoveredConditionId,
  );
  const data = baseData(
    "billing.subscription.recovered",
    input,
    "subscription_recovered",
    "recovered",
    { recovered: true },
    {
      conditionId: input.conditionId,
      recoveryOf: input.recoveredConditionId,
    },
  );
  return createMonetizationSignal(input, "billing.subscription.recovered", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
    recoveredConditionId: input.recoveredConditionId,
  });
}

export function createUsageThresholdCrossedSignal(
  input: UsageThresholdCrossedSignalInput,
): MonetizationLifecycleSignal<"billing.usage.threshold_crossed"> {
  assertSignalInput("billing.usage.threshold_crossed", input);
  assertNonEmpty("billing.usage.threshold_crossed", "meterKey", input.meterKey);
  assertFinite("billing.usage.threshold_crossed", "threshold", input.threshold, Number.EPSILON);
  assertFinite("billing.usage.threshold_crossed", "consumed", input.consumed);
  assertFinite("billing.usage.threshold_crossed", "limit", input.limit, Number.EPSILON);
  assertPeriod("billing.usage.threshold_crossed", input.periodStartsAt, input.periodEndsAt);
  if (input.consumed / input.limit < input.threshold) {
    throw new MonetizationSignalDefinitionProblem(
      "billing.usage.threshold_crossed",
      "consumed-to-limit ratio must meet or exceed threshold",
    );
  }
  const data = baseData(
    "billing.usage.threshold_crossed",
    input,
    "usage_threshold_crossed",
    "crossed",
    {
      meterKey: input.meterKey,
      threshold: input.threshold,
      consumed: input.consumed,
      limit: input.limit,
      ratio: input.consumed / input.limit,
      periodStartsAt: input.periodStartsAt.toISOString(),
      periodEndsAt: input.periodEndsAt.toISOString(),
    },
  );
  return createMonetizationSignal(input, "billing.usage.threshold_crossed", data, {
    meterKey: input.meterKey,
    planVersionRef: input.planVersionRef,
    threshold: input.threshold,
    periodStartsAt: input.periodStartsAt,
    periodEndsAt: input.periodEndsAt,
  });
}

export function createCreditBalanceLowSignal(
  input: CreditBalanceLowSignalInput,
): MonetizationLifecycleSignal<"billing.credit.balance_low"> {
  assertSignalInput("billing.credit.balance_low", input);
  assertNonEmpty("billing.credit.balance_low", "conditionId", input.conditionId);
  assertNonEmpty("billing.credit.balance_low", "unit", input.unit);
  assertFinite("billing.credit.balance_low", "balance", input.balance);
  assertFinite("billing.credit.balance_low", "threshold", input.threshold);
  if (input.balance > input.threshold) {
    throw new MonetizationSignalDefinitionProblem(
      "billing.credit.balance_low",
      "balance must be less than or equal to threshold",
    );
  }
  const data = baseData(
    "billing.credit.balance_low",
    input,
    "credit_balance_low",
    "low",
    {
      balance: input.balance,
      threshold: input.threshold,
      unit: input.unit,
    },
    { conditionId: input.conditionId },
  );
  return createMonetizationSignal(input, "billing.credit.balance_low", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
    threshold: input.threshold,
    unit: input.unit,
  });
}

export function createCreditExhaustedSignal(
  input: CreditExhaustedSignalInput,
): MonetizationLifecycleSignal<"billing.credit.exhausted"> {
  assertSignalInput("billing.credit.exhausted", input);
  assertNonEmpty("billing.credit.exhausted", "conditionId", input.conditionId);
  assertNonEmpty("billing.credit.exhausted", "unit", input.unit);
  assertFinite("billing.credit.exhausted", "balance", input.balance);
  if (input.balance !== 0) {
    throw new MonetizationSignalDefinitionProblem(
      "billing.credit.exhausted",
      "balance must be zero",
    );
  }
  const data = baseData(
    "billing.credit.exhausted",
    input,
    "credit_exhausted",
    "exhausted",
    {
      balance: input.balance,
      unit: input.unit,
    },
    { conditionId: input.conditionId },
  );
  return createMonetizationSignal(input, "billing.credit.exhausted", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
    unit: input.unit,
  });
}

export function createUsageDeliveryLaggingSignal(
  input: UsageDeliveryLaggingSignalInput,
): MonetizationLifecycleSignal<"billing.usage.delivery_lagging"> {
  assertSignalInput("billing.usage.delivery_lagging", input);
  assertNonEmpty("billing.usage.delivery_lagging", "conditionId", input.conditionId);
  assertNonEmpty("billing.usage.delivery_lagging", "meterKey", input.meterKey);
  assertFinite("billing.usage.delivery_lagging", "pendingRecordCount", input.pendingRecordCount, 1);
  assertValidDate("billing.usage.delivery_lagging", "oldestPendingAt", input.oldestPendingAt);
  assertValidDate("billing.usage.delivery_lagging", "periodEndsAt", input.periodEndsAt);
  const data = baseData(
    "billing.usage.delivery_lagging",
    input,
    "delivery_backlog",
    "lagging",
    {
      meterKey: input.meterKey,
      pendingRecordCount: input.pendingRecordCount,
      oldestPendingAt: input.oldestPendingAt.toISOString(),
      periodEndsAt: input.periodEndsAt.toISOString(),
    },
    { conditionId: input.conditionId },
  );
  return createMonetizationSignal(input, "billing.usage.delivery_lagging", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
  });
}

export function createUsageSyncDriftedSignal(
  input: UsageSyncDriftedSignalInput,
): MonetizationLifecycleSignal<"billing.usage.sync_drifted"> {
  assertSignalInput("billing.usage.sync_drifted", input);
  assertNonEmpty("billing.usage.sync_drifted", "conditionId", input.conditionId);
  assertNonEmpty("billing.usage.sync_drifted", "meterKey", input.meterKey);
  assertFinite("billing.usage.sync_drifted", "localRecorded", input.localRecorded);
  assertFinite("billing.usage.sync_drifted", "upstreamObserved", input.upstreamObserved);
  assertFinite("billing.usage.sync_drifted", "tolerance", input.tolerance);
  assertPeriod("billing.usage.sync_drifted", input.periodStartsAt, input.periodEndsAt);
  if (Math.abs(input.localRecorded - input.upstreamObserved) <= input.tolerance) {
    throw new MonetizationSignalDefinitionProblem(
      "billing.usage.sync_drifted",
      "absolute usage difference must exceed tolerance",
    );
  }
  const data = baseData(
    "billing.usage.sync_drifted",
    input,
    "usage_mismatch",
    "drifted",
    {
      meterKey: input.meterKey,
      localRecorded: input.localRecorded,
      upstreamObserved: input.upstreamObserved,
      difference: input.localRecorded - input.upstreamObserved,
      tolerance: input.tolerance,
      periodStartsAt: input.periodStartsAt.toISOString(),
      periodEndsAt: input.periodEndsAt.toISOString(),
    },
    { conditionId: input.conditionId },
  );
  return createMonetizationSignal(input, "billing.usage.sync_drifted", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
  });
}

export function createSeatQuantityDriftedSignal(
  input: SeatQuantityDriftedSignalInput,
): MonetizationLifecycleSignal<"billing.seat.quantity_drifted"> {
  assertSignalInput("billing.seat.quantity_drifted", input);
  assertNonEmpty("billing.seat.quantity_drifted", "conditionId", input.conditionId);
  assertFinite("billing.seat.quantity_drifted", "expectedQuantity", input.expectedQuantity);
  assertFinite("billing.seat.quantity_drifted", "observedQuantity", input.observedQuantity);
  if (input.expectedQuantity === input.observedQuantity) {
    throw new MonetizationSignalDefinitionProblem(
      "billing.seat.quantity_drifted",
      "expectedQuantity and observedQuantity must differ",
    );
  }
  const data = baseData(
    "billing.seat.quantity_drifted",
    input,
    "seat_quantity_mismatch",
    "drifted",
    {
      expectedQuantity: input.expectedQuantity,
      observedQuantity: input.observedQuantity,
      difference: input.expectedQuantity - input.observedQuantity,
    },
    { conditionId: input.conditionId },
  );
  return createMonetizationSignal(input, "billing.seat.quantity_drifted", data, {
    planVersionRef: input.planVersionRef,
    conditionId: input.conditionId,
  });
}

export type MonetizationConditionTransition = {
  readonly tenantId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly conditionId: string;
  readonly state: "past_due" | "recovered";
  readonly sourceAt: Date;
};

export type MonetizationConditionTransitionResult = {
  readonly accepted: boolean;
  readonly outOfOrder: boolean;
  readonly duplicate: boolean;
};

export interface MonetizationConditionStore {
  claimTransition(
    transition: MonetizationConditionTransition,
  ): Promise<MonetizationConditionTransitionResult>;
}

type ConditionState = {
  readonly state: MonetizationConditionTransition["state"];
  readonly sourceTimestamp: number;
};

function conditionScopeKey(transition: MonetizationConditionTransition): string {
  return [transition.tenantId, transition.planVersionRef, transition.conditionId].join("\u0000");
}

export class InMemoryMonetizationConditionStore implements MonetizationConditionStore {
  private readonly states = new Map<string, ConditionState>();

  async claimTransition(
    transition: MonetizationConditionTransition,
  ): Promise<MonetizationConditionTransitionResult> {
    const signalType =
      transition.state === "recovered"
        ? "billing.subscription.recovered"
        : "billing.subscription.past_due";
    assertNonEmpty(signalType, "tenantId", transition.tenantId);
    assertNonEmpty(signalType, "planVersionRef", transition.planVersionRef);
    assertNonEmpty(signalType, "conditionId", transition.conditionId);
    assertValidDate(signalType, "sourceAt", transition.sourceAt);
    const key = conditionScopeKey(transition);
    const sourceTimestamp = transition.sourceAt.getTime();
    const current = this.states.get(key);
    if (current && sourceTimestamp < current.sourceTimestamp) {
      return { accepted: false, outOfOrder: true, duplicate: false };
    }
    if (
      current &&
      sourceTimestamp === current.sourceTimestamp &&
      (current.state === transition.state ||
        (current.state === "recovered" && transition.state === "past_due"))
    ) {
      return {
        accepted: false,
        outOfOrder: false,
        duplicate: current.state === transition.state,
      };
    }
    this.states.set(key, { state: transition.state, sourceTimestamp });
    return { accepted: true, outOfOrder: false, duplicate: false };
  }
}

export type MonetizationConditionEvaluation<TSignal extends MonetizationLifecycleSignal> = {
  readonly signal: TSignal | null;
  readonly outOfOrder: boolean;
  readonly duplicate: boolean;
};

export class MonetizationSubscriptionConditionTracker {
  constructor(private readonly store: MonetizationConditionStore) {}

  async observePastDue(
    input: SubscriptionPastDueSignalInput,
  ): Promise<
    MonetizationConditionEvaluation<MonetizationLifecycleSignal<"billing.subscription.past_due">>
  > {
    const signal = createSubscriptionPastDueSignal(input);
    const result = await this.store.claimTransition({
      tenantId: input.tenantId,
      planVersionRef: input.planVersionRef,
      conditionId: input.conditionId,
      state: "past_due",
      sourceAt: input.sourceAt,
    });
    return {
      signal: result.accepted || result.duplicate ? signal : null,
      outOfOrder: result.outOfOrder,
      duplicate: result.duplicate,
    };
  }

  async observeRecovered(
    input: SubscriptionRecoveredSignalInput,
  ): Promise<
    MonetizationConditionEvaluation<MonetizationLifecycleSignal<"billing.subscription.recovered">>
  > {
    const signal = createSubscriptionRecoveredSignal(input);
    const result = await this.store.claimTransition({
      tenantId: input.tenantId,
      planVersionRef: input.planVersionRef,
      conditionId: input.recoveredConditionId,
      state: "recovered",
      sourceAt: input.sourceAt,
    });
    return {
      signal: result.accepted || result.duplicate ? signal : null,
      outOfOrder: result.outOfOrder,
      duplicate: result.duplicate,
    };
  }
}

export type MonetizationThresholdScope = {
  readonly tenantId: string;
  readonly meterKey: string;
  readonly planVersionRef: PlanVersionRef;
  readonly periodStartsAt: Date;
  readonly periodEndsAt: Date;
};

export type MonetizationThresholdClaim = MonetizationThresholdScope & {
  readonly thresholds: readonly number[];
  readonly ratio: number;
  readonly sourceAt: Date;
};

export type MonetizationThresholdClaimResult = {
  readonly claimId?: string;
  readonly crossedThresholds: readonly number[];
  readonly suppressedDuplicateCount: number;
  readonly outOfOrder: boolean;
};

export interface MonetizationThresholdStore {
  claimCrossings(claim: MonetizationThresholdClaim): Promise<MonetizationThresholdClaimResult>;
  acknowledgeCrossings(claimId: string): Promise<void>;
  releaseCrossings(claimId: string): Promise<void>;
  getDiagnostics(): Promise<MonetizationThresholdDiagnostics>;
}

export type MonetizationThresholdDiagnostics = {
  readonly scopeCount: number;
  readonly emittedCrossingCount: number;
  readonly pendingCrossingCount: number;
  readonly expiredClaimCount: number;
  readonly suppressedDuplicateCount: number;
  readonly outOfOrderObservationCount: number;
};

type ThresholdState = {
  readonly crossed: Set<number>;
  readonly retryableReservations: ThresholdReservation[];
  deferredSourceAt: number;
  latestSourceAt: number;
};

type ThresholdReservation = {
  readonly scopeKey: string;
  readonly thresholds: readonly number[];
  readonly sourceTimestamp: number;
  readonly expiresAt: number;
};

function thresholdScopeKey(scope: MonetizationThresholdScope): string {
  return [
    scope.tenantId,
    scope.meterKey,
    scope.planVersionRef,
    scope.periodStartsAt.toISOString(),
    scope.periodEndsAt.toISOString(),
  ].join("\u0000");
}

function normalizeThresholds(thresholds: readonly number[]): readonly number[] {
  const normalized = [...new Set(thresholds)].sort((left, right) => left - right);
  if (
    normalized.length === 0 ||
    normalized.some((threshold) => !Number.isFinite(threshold) || threshold <= 0)
  ) {
    throw new MonetizationSignalDefinitionProblem(
      "billing.usage.threshold_crossed",
      "thresholds must contain positive finite levels",
    );
  }
  return normalized;
}

export type InMemoryMonetizationThresholdStoreOptions = {
  readonly claimLeaseDurationMs?: number;
  readonly now?: () => Date;
};

export class InMemoryMonetizationThresholdStore implements MonetizationThresholdStore {
  private readonly states = new Map<string, ThresholdState>();
  private readonly reservations = new Map<string, ThresholdReservation>();
  private emittedCrossingCount = 0;
  private expiredClaimCount = 0;
  private suppressedDuplicateCount = 0;
  private outOfOrderObservationCount = 0;

  constructor(private readonly options: InMemoryMonetizationThresholdStoreOptions = {}) {}

  private reconcileSourceWatermark(scopeKey: string): void {
    const state = this.states.get(scopeKey);
    if (!state) {
      return;
    }
    const barriers = [
      ...state.retryableReservations.map((reservation) => reservation.sourceTimestamp),
      ...[...this.reservations.values()]
        .filter((reservation) => reservation.scopeKey === scopeKey)
        .map((reservation) => reservation.sourceTimestamp),
    ];
    if (barriers.length === 0) {
      state.latestSourceAt = Math.max(state.latestSourceAt, state.deferredSourceAt);
      state.deferredSourceAt = Number.NEGATIVE_INFINITY;
      return;
    }
    state.latestSourceAt = Math.max(
      state.latestSourceAt,
      Math.min(state.deferredSourceAt, ...barriers),
    );
  }

  private makeReservationRetryable(reservation: ThresholdReservation): void {
    const state = this.states.get(reservation.scopeKey);
    if (state) {
      state.retryableReservations.push(reservation);
      this.reconcileSourceWatermark(reservation.scopeKey);
    }
  }

  private pruneExpiredReservations(): void {
    const now = (this.options.now ?? (() => new Date()))().getTime();
    for (const [claimId, reservation] of this.reservations) {
      if (reservation.expiresAt <= now) {
        this.reservations.delete(claimId);
        this.makeReservationRetryable(reservation);
        this.expiredClaimCount += 1;
      }
    }
  }

  async claimCrossings(
    claim: MonetizationThresholdClaim,
  ): Promise<MonetizationThresholdClaimResult> {
    this.pruneExpiredReservations();
    const thresholds = normalizeThresholds(claim.thresholds);
    assertNonEmpty("billing.usage.threshold_crossed", "tenantId", claim.tenantId);
    assertNonEmpty("billing.usage.threshold_crossed", "meterKey", claim.meterKey);
    assertNonEmpty("billing.usage.threshold_crossed", "planVersionRef", claim.planVersionRef);
    assertValidDate("billing.usage.threshold_crossed", "sourceAt", claim.sourceAt);
    assertPeriod("billing.usage.threshold_crossed", claim.periodStartsAt, claim.periodEndsAt);
    assertFinite("billing.usage.threshold_crossed", "ratio", claim.ratio);
    const key = thresholdScopeKey(claim);
    const sourceTimestamp = claim.sourceAt.getTime();
    const state = this.states.get(key);
    if (state && sourceTimestamp < state.latestSourceAt) {
      this.outOfOrderObservationCount += 1;
      return {
        crossedThresholds: [],
        suppressedDuplicateCount: 0,
        outOfOrder: true,
      };
    }

    const current = state ?? {
      crossed: new Set<number>(),
      retryableReservations: [],
      deferredSourceAt: Number.NEGATIVE_INFINITY,
      latestSourceAt: Number.NEGATIVE_INFINITY,
    };
    const eligible = thresholds.filter((threshold) => claim.ratio >= threshold);
    const scopeReservations = [...this.reservations.values()].filter(
      (reservation) => reservation.scopeKey === key,
    );
    const pendingThresholds = new Set(
      scopeReservations.flatMap((reservation) => reservation.thresholds),
    );
    const crossedThresholds = eligible.filter(
      (threshold) => !current.crossed.has(threshold) && !pendingThresholds.has(threshold),
    );
    const suppressedDuplicateCount = eligible.length - crossedThresholds.length;
    if (crossedThresholds.length === 0) {
      current.deferredSourceAt = Math.max(current.deferredSourceAt, sourceTimestamp);
      if (scopeReservations.length === 0 && current.retryableReservations.length === 0) {
        current.latestSourceAt = Math.max(current.latestSourceAt, current.deferredSourceAt);
        current.deferredSourceAt = Number.NEGATIVE_INFINITY;
      }
    }
    this.states.set(key, current);
    this.suppressedDuplicateCount += suppressedDuplicateCount;
    const claimId =
      crossedThresholds.length === 0
        ? undefined
        : createHash("sha256")
            .update(
              JSON.stringify(
                canonicalize({
                  scopeKey: key,
                  sourceAt: claim.sourceAt,
                  thresholds: crossedThresholds,
                }),
              ),
            )
            .digest("hex");
    if (claimId) {
      const now = (this.options.now ?? (() => new Date()))().getTime();
      this.reservations.set(claimId, {
        scopeKey: key,
        thresholds: crossedThresholds,
        sourceTimestamp,
        expiresAt: now + (this.options.claimLeaseDurationMs ?? 30_000),
      });
    }
    return {
      claimId,
      crossedThresholds,
      suppressedDuplicateCount,
      outOfOrder: false,
    };
  }

  async acknowledgeCrossings(claimId: string): Promise<void> {
    this.pruneExpiredReservations();
    const reservation = this.reservations.get(claimId);
    if (!reservation) {
      throw new MonetizationThresholdClaimProblem(claimId);
    }
    const state = this.states.get(reservation.scopeKey);
    if (state) {
      for (const threshold of reservation.thresholds) {
        state.crossed.add(threshold);
      }
      for (let index = state.retryableReservations.length - 1; index >= 0; index -= 1) {
        const retryable = state.retryableReservations[index];
        if (
          retryable &&
          retryable.sourceTimestamp <= reservation.sourceTimestamp &&
          retryable.thresholds.every((threshold) => state.crossed.has(threshold))
        ) {
          state.retryableReservations.splice(index, 1);
        }
      }
      state.deferredSourceAt = Math.max(state.deferredSourceAt, reservation.sourceTimestamp);
    }
    this.emittedCrossingCount += reservation.thresholds.length;
    this.reservations.delete(claimId);
    this.reconcileSourceWatermark(reservation.scopeKey);
  }

  async releaseCrossings(claimId: string): Promise<void> {
    const reservation = this.reservations.get(claimId);
    if (reservation) {
      this.reservations.delete(claimId);
      this.makeReservationRetryable(reservation);
    }
  }

  async getDiagnostics(): Promise<MonetizationThresholdDiagnostics> {
    this.pruneExpiredReservations();
    return {
      scopeCount: this.states.size,
      emittedCrossingCount: this.emittedCrossingCount,
      pendingCrossingCount: [...this.reservations.values()].reduce(
        (count, reservation) => count + reservation.thresholds.length,
        0,
      ),
      expiredClaimCount: this.expiredClaimCount,
      suppressedDuplicateCount: this.suppressedDuplicateCount,
      outOfOrderObservationCount: this.outOfOrderObservationCount,
    };
  }
}

export type MonetizationThresholdEvaluation = {
  readonly claimId?: string;
  readonly signals: readonly MonetizationLifecycleSignal<"billing.usage.threshold_crossed">[];
  readonly suppressedDuplicateCount: number;
  readonly outOfOrder: boolean;
};

export class MonetizationThresholdTracker {
  constructor(private readonly store: MonetizationThresholdStore) {}

  async evaluate(
    input: Omit<UsageThresholdCrossedSignalInput, "threshold"> & {
      readonly thresholds: readonly number[];
    },
  ): Promise<MonetizationThresholdEvaluation> {
    assertSignalInput("billing.usage.threshold_crossed", input);
    assertNonEmpty("billing.usage.threshold_crossed", "meterKey", input.meterKey);
    assertFinite("billing.usage.threshold_crossed", "consumed", input.consumed);
    assertFinite("billing.usage.threshold_crossed", "limit", input.limit, Number.EPSILON);
    assertPeriod("billing.usage.threshold_crossed", input.periodStartsAt, input.periodEndsAt);
    const ratio = input.consumed / input.limit;
    const claim = await this.store.claimCrossings({
      tenantId: input.tenantId,
      meterKey: input.meterKey,
      planVersionRef: input.planVersionRef,
      periodStartsAt: input.periodStartsAt,
      periodEndsAt: input.periodEndsAt,
      thresholds: input.thresholds,
      ratio,
      sourceAt: input.sourceAt,
    });
    try {
      return {
        claimId: claim.claimId,
        signals: claim.crossedThresholds.map((threshold) =>
          createUsageThresholdCrossedSignal({ ...input, threshold }),
        ),
        suppressedDuplicateCount: claim.suppressedDuplicateCount,
        outOfOrder: claim.outOfOrder,
      };
    } catch (error) {
      if (claim.claimId) {
        await this.store.releaseCrossings(claim.claimId);
      }
      throw error;
    }
  }

  async acknowledge(evaluation: MonetizationThresholdEvaluation): Promise<void> {
    if (evaluation.claimId) {
      await this.store.acknowledgeCrossings(evaluation.claimId);
    }
  }

  async release(evaluation: MonetizationThresholdEvaluation): Promise<void> {
    if (evaluation.claimId) {
      await this.store.releaseCrossings(evaluation.claimId);
    }
  }
}

export type MonetizationRecipeDescriptor = {
  readonly id: MonetizationRecipeId;
  readonly version: "1.0.0";
  readonly signalTypes: readonly MonetizationSignalType[];
  readonly requiredSignalSources: readonly MonetizationSignalType[];
  readonly requiredActionTypes: readonly string[];
  readonly contextRequirements: readonly string[];
  readonly supportsRecovery: boolean;
};

export type MonetizationRecipeDefinition = {
  readonly descriptor: MonetizationRecipeDescriptor;
  readonly registration: LifecycleRuleRegistrationInput;
};

export type MonetizationRecipeCapabilities = {
  readonly signalSources: readonly MonetizationSignalType[];
  readonly actionTypes: readonly string[];
};

export interface MonetizationCapabilitySource {
  getCapabilities(): MonetizationRecipeCapabilities | Promise<MonetizationRecipeCapabilities>;
}

export type MonetizationRecipeCapabilityDiagnostic = {
  readonly code: "lifecycle-core/monetization-recipe-capability-missing";
  readonly recipeId: MonetizationRecipeId;
  readonly missingCapabilities: readonly string[];
};

export type MonetizationLifecycleArtifact = {
  readonly schemaVersion: "croco.lifecycle.monetization/v1";
  readonly signals: readonly MonetizationSignalDescriptor[];
  readonly recipes: readonly MonetizationRecipeDescriptor[];
  readonly diagnostics: readonly MonetizationRecipeCapabilityDiagnostic[];
};

type RecipeSpec = {
  readonly id: MonetizationRecipeId;
  readonly description: string;
  readonly triggers: readonly MonetizationSignalType[];
  readonly severity: "medium" | "high" | "critical";
  readonly actionDescriptors: readonly LifecycleRuleActionDescriptor[];
  readonly cooldownDurationMs?: number;
  readonly supportsRecovery?: boolean;
  readonly thresholdRange?: {
    readonly minimumInclusive: number;
    readonly maximumExclusive?: number;
  };
  readonly actionIdsBySignalType?: Partial<
    Readonly<Record<MonetizationSignalType, readonly string[]>>
  >;
};

const RECIPE_EXECUTION_MODEL_VERSION = "2";

type RecipeSignalData = {
  readonly effectiveAt: string;
  readonly sourceAt: string;
  readonly reason: MonetizationSignalReason;
  readonly status: string;
  readonly conditionId?: string;
  readonly recoveryOf?: string;
  readonly evidence?: MonetizationSafeEvidence;
};

function signalData(signal: LifecycleSignal): RecipeSignalData | undefined {
  return signal.source === "monetization" ? (signal.data as RecipeSignalData) : undefined;
}

function action(
  descriptor: LifecycleRuleActionDescriptor,
  contextData: RecipeSignalData,
): LifecycleAction {
  return {
    id: descriptor.id,
    type: descriptor.type,
    title: descriptor.title,
    description: descriptor.description,
    payload: {
      status: contextData.status,
      reason: contextData.reason,
      conditionId: contextData.conditionId,
      recoveryOf: contextData.recoveryOf,
      evidence: contextData.evidence,
    },
  };
}

function createRecipe(spec: RecipeSpec): MonetizationRecipeDefinition {
  const descriptor: MonetizationRecipeDescriptor = {
    id: spec.id,
    version: "1.0.0",
    signalTypes: [...spec.triggers],
    requiredSignalSources: [...spec.triggers],
    requiredActionTypes: [...new Set(spec.actionDescriptors.map((entry) => entry.type))].sort(),
    contextRequirements: [
      "signal.data.effectiveAt",
      "signal.data.evidence",
      "signal.data.sourceAt",
    ],
    supportsRecovery: spec.supportsRecovery ?? false,
  };
  const executableFingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize({
          descriptor,
          executionModelVersion: RECIPE_EXECUTION_MODEL_VERSION,
          actionDescriptors: spec.actionDescriptors,
          actionIdsBySignalType: spec.actionIdsBySignalType,
          cooldownDurationMs: spec.cooldownDurationMs,
          thresholdRange: spec.thresholdRange,
        }),
      ),
    )
    .digest("hex");
  return {
    descriptor,
    registration: {
      rule: {
        id: spec.id,
        description: spec.description,
        triggers: spec.triggers.map((type) => ({ type })),
        severity: spec.severity,
        cooldown: spec.cooldownDurationMs ? { durationMs: spec.cooldownDurationMs } : undefined,
        idempotencyKey: ({ context }) =>
          context.signal.id ?? context.signal.occurredAt.toISOString(),
        when: (context) => {
          const data = signalData(context.signal);
          if (!data) {
            return false;
          }
          if (!spec.thresholdRange) {
            return true;
          }
          const threshold = data.evidence?.threshold;
          return (
            typeof threshold === "number" &&
            threshold >= spec.thresholdRange.minimumInclusive &&
            (spec.thresholdRange.maximumExclusive === undefined ||
              threshold < spec.thresholdRange.maximumExclusive)
          );
        },
        conditionEvidence: (context) => ({
          monetizationSource: signalData(context.signal) !== undefined,
          safeEvidencePresent: signalData(context.signal)?.evidence !== undefined,
        }),
        actions: (context) => {
          const data = signalData(context.signal);
          if (!data) {
            return [];
          }
          const selectedIds =
            spec.actionIdsBySignalType?.[context.signal.type as MonetizationSignalType];
          const selectedDescriptors =
            selectedIds === undefined
              ? spec.actionDescriptors
              : spec.actionDescriptors.filter((entry) => selectedIds.includes(entry.id));
          return selectedDescriptors.map((entry) => action(entry, data));
        },
      },
      version: "1.0.0",
      executableRegistrationId: `${spec.id}:builtin`,
      executableFingerprint,
      contextRequirements: descriptor.contextRequirements,
      actionDescriptors: spec.actionDescriptors,
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createTrialEndingReminderRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.trial-ending-reminder",
    description: "Notify a tenant as its trial approaches the effective end.",
    triggers: ["billing.trial.ending"],
    severity: "medium",
    cooldownDurationMs: DAY_MS,
    actionDescriptors: [
      { id: "trial-ending-reminder", type: "customer.notify", title: "Trial ending reminder" },
    ],
  });
}

export function createPastDueGraceFollowUpRecipe(): MonetizationRecipeDefinition {
  const descriptors = [
    { id: "past-due-notification", type: "customer.notify", title: "Past-due notification" },
    { id: "past-due-cs-follow-up", type: "cs.follow_up", title: "Past-due CS follow-up" },
    {
      id: "billing-recovery-closed",
      type: "cs.billing_recovered",
      title: "Close billing follow-up",
    },
  ] as const;
  return createRecipe({
    id: "monetization.past-due-grace-follow-up",
    description: "Notify and follow up on delinquency, then close the correlated recovery.",
    triggers: ["billing.subscription.past_due", "billing.subscription.recovered"],
    severity: "high",
    supportsRecovery: true,
    actionDescriptors: descriptors,
    actionIdsBySignalType: {
      "billing.subscription.past_due": ["past-due-notification", "past-due-cs-follow-up"],
      "billing.subscription.recovered": ["billing-recovery-closed"],
    },
  });
}

export function createUsageUpgradePromptRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.usage-80-upgrade-prompt",
    description: "Prompt for an upgrade when usage crosses the 80 percent threshold.",
    triggers: ["billing.usage.threshold_crossed"],
    severity: "medium",
    thresholdRange: { minimumInclusive: 0.8, maximumExclusive: 1 },
    actionDescriptors: [
      {
        id: "usage-upgrade-prompt",
        type: "customer.upgrade_prompt",
        title: "Usage upgrade prompt",
      },
    ],
  });
}

export function createQuotaReachedNotificationRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.quota-reached-notification",
    description: "Notify customer and operator when usage reaches quota or an overage band.",
    triggers: ["billing.usage.threshold_crossed"],
    severity: "high",
    thresholdRange: { minimumInclusive: 1 },
    actionDescriptors: [
      { id: "quota-customer-notification", type: "customer.notify", title: "Quota reached" },
      { id: "quota-operator-notification", type: "operator.notify", title: "Tenant quota reached" },
    ],
  });
}

export function createLowCreditWarningRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.low-credit-warning",
    description: "Warn a tenant when credits are low or exhausted.",
    triggers: ["billing.credit.balance_low", "billing.credit.exhausted"],
    severity: "high",
    actionDescriptors: [
      { id: "low-credit-warning", type: "customer.notify", title: "Credit balance warning" },
    ],
  });
}

export function createDeliveryBacklogEscalationRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.delivery-backlog-escalation",
    description: "Escalate a billable usage delivery backlog before period close.",
    triggers: ["billing.usage.delivery_lagging"],
    severity: "critical",
    cooldownDurationMs: DAY_MS,
    actionDescriptors: [
      {
        id: "delivery-backlog-escalation",
        type: "operator.escalate",
        title: "Usage delivery backlog",
      },
    ],
  });
}

export function createUsageDriftEscalationRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.usage-drift-escalation",
    description: "Escalate local and upstream billable usage drift.",
    triggers: ["billing.usage.sync_drifted"],
    severity: "critical",
    cooldownDurationMs: DAY_MS,
    actionDescriptors: [
      { id: "usage-drift-escalation", type: "operator.escalate", title: "Usage sync drift" },
    ],
  });
}

export function createSeatDriftEscalationRecipe(): MonetizationRecipeDefinition {
  return createRecipe({
    id: "monetization.seat-drift-escalation",
    description: "Escalate expected and observed licensed seat quantity drift.",
    triggers: ["billing.seat.quantity_drifted"],
    severity: "critical",
    cooldownDurationMs: DAY_MS,
    actionDescriptors: [
      { id: "seat-drift-escalation", type: "operator.escalate", title: "Licensed seat drift" },
    ],
  });
}

export function createMonetizationReferenceRecipes(): readonly MonetizationRecipeDefinition[] {
  return [
    createTrialEndingReminderRecipe(),
    createPastDueGraceFollowUpRecipe(),
    createUsageUpgradePromptRecipe(),
    createQuotaReachedNotificationRecipe(),
    createLowCreditWarningRecipe(),
    createDeliveryBacklogEscalationRecipe(),
    createUsageDriftEscalationRecipe(),
    createSeatDriftEscalationRecipe(),
  ];
}

function missingCapabilities(
  recipe: MonetizationRecipeDefinition,
  capabilities: MonetizationRecipeCapabilities,
): readonly string[] {
  const sources = new Set(capabilities.signalSources);
  const actions = new Set(capabilities.actionTypes);
  return [
    ...recipe.descriptor.requiredSignalSources
      .filter((source) => !sources.has(source))
      .map((source) => `signal:${source}`),
    ...recipe.descriptor.requiredActionTypes
      .filter((actionType) => !actions.has(actionType))
      .map((actionType) => `action:${actionType}`),
  ].sort();
}

export function validateMonetizationRecipeCapabilities(
  recipe: MonetizationRecipeDefinition,
  capabilities: MonetizationRecipeCapabilities,
): readonly MonetizationRecipeCapabilityDiagnostic[] {
  const missing = missingCapabilities(recipe, capabilities);
  return missing.length === 0
    ? []
    : [
        {
          code: "lifecycle-core/monetization-recipe-capability-missing",
          recipeId: recipe.descriptor.id,
          missingCapabilities: missing,
        },
      ];
}

export async function installMonetizationRecipe(
  registry: LifecycleRuleRegistry,
  recipe: MonetizationRecipeDefinition,
  capabilities: MonetizationRecipeCapabilities,
  options: { readonly activate?: boolean; readonly registeredAt?: Date } = {},
): Promise<LifecycleRuleRegistration> {
  const missing = missingCapabilities(recipe, capabilities);
  if (missing.length > 0) {
    throw new MonetizationRecipeCapabilityProblem(recipe.descriptor.id, missing);
  }
  return registry.registerVersion({
    ...recipe.registration,
    activate: options.activate,
    registeredAt: options.registeredAt,
  });
}

export function createMonetizationLifecycleArtifact(
  recipes: readonly MonetizationRecipeDefinition[],
  capabilities: MonetizationRecipeCapabilities,
): MonetizationLifecycleArtifact {
  const sortedRecipes = [...recipes].sort((left, right) =>
    left.descriptor.id.localeCompare(right.descriptor.id),
  );
  return {
    schemaVersion: "croco.lifecycle.monetization/v1",
    signals: [...MONETIZATION_SIGNAL_DESCRIPTORS].sort((left, right) =>
      left.type.localeCompare(right.type),
    ),
    recipes: sortedRecipes.map((recipe) => recipe.descriptor),
    diagnostics: sortedRecipes.flatMap((recipe) =>
      validateMonetizationRecipeCapabilities(recipe, capabilities),
    ),
  };
}
