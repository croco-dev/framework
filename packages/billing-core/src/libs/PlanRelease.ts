import { createHash } from "node:crypto";

import type { PlanVersionDefinition, PlanVersionRef } from "../types";

export type PlanReleaseState =
  | "draft"
  | "in_review"
  | "scheduled"
  | "published"
  | "superseded"
  | "abandoned";

export type PlanReleaseActor = {
  readonly id: string;
  readonly displayName?: string;
};

export type PlanReleaseValidationDiagnostic = {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly target: string;
  readonly message: string;
  readonly contractId?: string;
  readonly source: "credential-free-structural" | "remote-provider-preflight";
};

/**
 * ContractGraph evidence whose planVersionRef, definitionFingerprint, draftRevision, graphVersion,
 * snapshotId, and checkedAt bindings are verified locally without re-running validation.
 */
export type PlanReleaseValidationEvidence = {
  readonly graphVersion: string;
  readonly snapshotId: string;
  readonly planVersionRef: PlanVersionRef;
  readonly definitionFingerprint: string;
  readonly draftRevision: number;
  readonly checkedAt: string;
  readonly diagnostics: readonly PlanReleaseValidationDiagnostic[];
};

export type PlanReleaseImpactFact = {
  readonly code: string;
  readonly message: string;
  readonly references: readonly string[];
  readonly outcome?: "pass" | "fail";
};

export type PlanReleaseImpactEstimate = PlanReleaseImpactFact & {
  readonly confidence: "low" | "medium" | "high";
};

export type PlanReleaseImpactPreview = {
  readonly audience:
    | "new_subscriptions"
    | "grandfathered_subscriptions"
    | { readonly migrationCohortId: string };
  readonly calculatedFacts: readonly PlanReleaseImpactFact[];
  readonly providerPreflightFacts: readonly PlanReleaseImpactFact[];
  readonly estimates: readonly PlanReleaseImpactEstimate[];
  readonly providerCapabilitiesRequired: readonly string[];
};

export type PlanVersionSemanticDiffField =
  | "recurring_price"
  | "seat_price"
  | "seat_inclusion"
  | "usage_tiers"
  | "entitlements"
  | "quota"
  | "trial"
  | "provider_binding"
  | "effective_dates";

export type PlanVersionSemanticDiffRecord = {
  readonly field: PlanVersionSemanticDiffField;
  readonly before: unknown;
  readonly after: unknown;
};

export type PlanReleaseReviewEvidence = {
  readonly reviewedDraftRevision: number;
  readonly reviewedDefinition: PlanVersionDefinition;
  readonly validation: PlanReleaseValidationEvidence;
  readonly semanticDiff: readonly PlanVersionSemanticDiffRecord[];
  readonly impact: PlanReleaseImpactPreview;
  readonly reviewedAt: string;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
};

export type PlanReleasePublicationEvidence = {
  readonly reviewedDraftRevision: number;
  readonly validationSnapshotId: string;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly commandFingerprint: string;
  readonly publishedAt: string;
};

export type PlanReleasePublicationIntent = {
  readonly reviewedDraftRevision: number;
  readonly validationSnapshotId: string;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly commandFingerprint: string;
  readonly reservedAt: string;
};

export type PlanReleasePublicationFailure = {
  readonly idempotencyKey: string;
  readonly commandFingerprint: string;
  readonly code: string;
  readonly detail: string;
  readonly failedAt: string;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
};

export type PlanReleaseTransitionRecord = {
  readonly from: PlanReleaseState | null;
  readonly to: PlanReleaseState;
  readonly revision: number;
  readonly occurredAt: string;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
};

export type PlanRelease = {
  readonly ref: PlanVersionRef;
  readonly state: PlanReleaseState;
  readonly revision: number;
  readonly definition: PlanVersionDefinition;
  readonly review?: PlanReleaseReviewEvidence;
  readonly publicationIntent?: PlanReleasePublicationIntent;
  readonly publicationFailures?: readonly PlanReleasePublicationFailure[];
  readonly publication?: PlanReleasePublicationEvidence;
  readonly scheduledFor?: string;
  readonly supersededBy?: PlanVersionRef;
  readonly history: readonly PlanReleaseTransitionRecord[];
};

export interface PlanReleaseValidator {
  validate(input: {
    readonly definition: PlanVersionDefinition;
    readonly definitionFingerprint: string;
    readonly draftRevision: number;
  }): Promise<PlanReleaseValidationEvidence>;
}

export interface PlanReleaseImpactAnalyzer {
  analyze(input: {
    readonly previous: PlanVersionDefinition | null;
    readonly proposed: PlanVersionDefinition;
    readonly audience: PlanReleaseImpactPreview["audience"];
    readonly validation: PlanReleaseValidationEvidence;
  }): Promise<PlanReleaseImpactPreview>;
}

export interface PlanReleaseStore {
  /** Atomically creates the draft and appends its lifecycle event to the durable outbox. */
  create(release: PlanRelease, event: PlanReleaseLifecycleEvent): Promise<void>;
  get(ref: PlanVersionRef): Promise<PlanRelease | null>;
  list(planId?: string): Promise<readonly PlanRelease[]>;
  /** Atomically applies revision CAS, optional family-period exclusion, and optional outbox append. */
  save(
    release: PlanRelease,
    expectedRevision: number,
    options?: PlanReleaseStoreSaveOptions,
  ): Promise<void>;
  listPendingEvents(ref?: PlanVersionRef): Promise<readonly PlanReleaseLifecycleEvent[]>;
  markEventPublished(eventId: string): Promise<void>;
}

export type PlanReleaseStoreSaveOptions = {
  readonly event?: PlanReleaseLifecycleEvent;
  readonly enforceNoEffectivePeriodOverlap?: boolean;
};

export interface PlanReleaseEventPublisher {
  /** Must deduplicate retries and concurrent deliveries by `event.eventId`. */
  publishIdempotently(event: PlanReleaseLifecycleEvent): Promise<void>;
}

export type PlanReleaseLifecycleEvent = {
  readonly eventId: string;
  readonly eventName: string;
  readonly timestamp: Date;
  readonly planVersionRef: PlanVersionRef;
  readonly from: PlanReleaseState | null;
  readonly to: PlanReleaseState;
  readonly revision: number;
  readonly actorId: string;
  readonly reason: string;
};

export type PlanReleaseEventDeliveryResult = {
  readonly attempted: number;
  readonly published: number;
  readonly pending: number;
  readonly failures: readonly {
    readonly eventId: string;
    readonly detail: string;
  }[];
};

export type CreatePlanDraftCommand = {
  readonly definition: PlanVersionDefinition;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
};

export type UpdatePlanDraftCommand = CreatePlanDraftCommand & {
  readonly expectedRevision: number;
};

export type PlanReleaseTransitionCommand = {
  readonly ref: PlanVersionRef;
  readonly expectedRevision: number;
  readonly actor: PlanReleaseActor;
  readonly reason: string;
};

export type SubmitPlanReviewCommand = PlanReleaseTransitionCommand & {
  readonly audience: PlanReleaseImpactPreview["audience"];
};

export type PublishPlanReleaseCommand = PlanReleaseTransitionCommand & {
  readonly idempotencyKey: string;
};

export type SupersedePlanReleaseCommand = PlanReleaseTransitionCommand & {
  readonly replacementRef: PlanVersionRef;
};

export function createPlanVersionSemanticDiff(
  previous: PlanVersionDefinition | null,
  proposed: PlanVersionDefinition,
): readonly PlanVersionSemanticDiffRecord[] {
  const before = previous ? semanticFields(previous) : null;
  const after = semanticFields(proposed);
  const fields = Object.keys(after) as PlanVersionSemanticDiffField[];

  return fields
    .filter((field) => stableStringify(before?.[field] ?? null) !== stableStringify(after[field]))
    .sort()
    .map((field) => ({
      field,
      before: before?.[field] ?? null,
      after: after[field],
    }));
}

export function planReleaseCommandFingerprint(command: PublishPlanReleaseCommand): string {
  const canonical = stableStringify({
    ref: command.ref,
    expectedRevision: command.expectedRevision,
    actor: command.actor,
    reason: command.reason,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function effectivePeriodsConflict(
  left: PlanVersionDefinition,
  right: PlanVersionDefinition,
): boolean {
  const leftStart = Date.parse(left.effectiveAt);
  const rightStart = Date.parse(right.effectiveAt);
  if (leftStart === rightStart) return true;
  if (leftStart < rightStart && left.effectiveUntil === undefined) return false;
  if (rightStart < leftStart && right.effectiveUntil === undefined) return false;

  const leftEnd = left.effectiveUntil ? Date.parse(left.effectiveUntil) : Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil
    ? Date.parse(right.effectiveUntil)
    : Number.POSITIVE_INFINITY;
  return leftStart < rightEnd && rightStart < leftEnd;
}

/** Stable digest binding validation evidence to the exact reviewed draft definition. */
export function planVersionDefinitionFingerprint(definition: PlanVersionDefinition): string {
  return `sha256:${createHash("sha256").update(stableStringify(definition)).digest("hex")}`;
}

function semanticFields(
  definition: PlanVersionDefinition,
): Record<PlanVersionSemanticDiffField, unknown> {
  return {
    recurring_price: {
      amount: definition.amount,
      currency: definition.currency.toUpperCase(),
      interval: definition.interval,
      intervalCount: definition.intervalCount,
    },
    seat_price: definition.seatUnitAmount ?? null,
    seat_inclusion: {
      includedSeats: definition.quantityPolicy.includedSeats,
      minimumQuantity: definition.quantityPolicy.minimumQuantity,
      billableMembershipRoles: [...definition.quantityPolicy.billableMembershipRoles].sort(),
    },
    usage_tiers: [...(definition.usageTiers ?? [])]
      .map((tier) => ({ ...tier }))
      .sort((left, right) => {
        const meterDifference = left.meterKey.localeCompare(right.meterKey);
        if (meterDifference !== 0) return meterDifference;
        const leftUpTo = left.upTo ?? Number.POSITIVE_INFINITY;
        const rightUpTo = right.upTo ?? Number.POSITIVE_INFINITY;
        if (leftUpTo !== rightUpTo) return leftUpTo - rightUpTo;
        return left.unitAmount - right.unitAmount;
      }),
    entitlements: [...(definition.entitlements ?? [])]
      .map((entitlement) => ({ ...entitlement }))
      .sort((left, right) => left.featureKey.localeCompare(right.featureKey)),
    quota: definition.quantityPolicy.seatQuota,
    trial: definition.trial ? { ...definition.trial } : null,
    provider_binding: {
      rating: definition.rating,
      bindings: [...definition.providerBindings]
        .map((binding) => ({
          provider: binding.provider,
          productId: binding.productId,
          priceIds: [...new Set(binding.priceIds)].sort(),
          meterBindings: [...(binding.meterBindings ?? [])]
            .map((meter) => ({ ...meter }))
            .sort((left, right) => left.meterKey.localeCompare(right.meterKey)),
        }))
        .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))),
    },
    effective_dates: {
      effectiveAt: definition.effectiveAt,
      effectiveUntil: definition.effectiveUntil ?? null,
    },
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
