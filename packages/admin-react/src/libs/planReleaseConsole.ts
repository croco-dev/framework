import type { PlanRelease, PlanVersionDefinition } from "@croco/billing-core";
import type { ProblemDetails } from "@croco/problems-core";

export type PlanReleaseConsolePhase =
  | "draft-editing"
  | "validation"
  | "review"
  | "scheduling"
  | "publishing"
  | "published";

export type PlanReleaseDraft = {
  readonly revision: number;
  readonly definition: PlanVersionDefinition;
};

export type PlanReleaseConsoleSnapshot = {
  /** Optimistic-concurrency revision used by billing-core transition commands. */
  readonly releaseRevision: number;
  readonly currentPublished: PlanVersionDefinition | null;
  readonly candidate: PlanReleaseDraft;
};

export type PlanReleaseCatalogOption = { readonly key: string; readonly label: string };
export type PlanReleaseEditorCatalog = {
  readonly meters: readonly PlanReleaseCatalogOption[];
  readonly entitlements: readonly PlanReleaseCatalogOption[];
  readonly pricing: readonly PlanReleaseCatalogOption[];
  readonly providers: readonly PlanReleaseCatalogOption[];
  readonly providerProducts: readonly PlanReleaseCatalogOption[];
  readonly providerPrices: readonly PlanReleaseCatalogOption[];
  readonly providerMeters: readonly PlanReleaseCatalogOption[];
};
export type PlanReleaseCatalogName = keyof PlanReleaseEditorCatalog;
export type PlanReleaseSemanticDiffGroupName =
  | "price"
  | "seats"
  | "usage"
  | "entitlements"
  | "trial"
  | "provider"
  | "effective-time";

/** Code declares both the readable value and the only permitted mutation for a field. */
type PlanReleaseFieldDescriptorBase = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly group: PlanReleaseSemanticDiffGroupName;
  readonly destructive?: boolean;
  readonly read: (definition: PlanVersionDefinition) => string | number;
  readonly write: (
    definition: PlanVersionDefinition,
    value: string | number,
  ) => PlanVersionDefinition;
};

export type PlanReleaseFieldDescriptor = PlanReleaseFieldDescriptorBase &
  (
    | {
        readonly input: "select";
        readonly catalog: PlanReleaseCatalogName;
      }
    | {
        readonly input: "text" | "number" | "datetime-local";
        readonly catalog?: never;
      }
  );

export type PlanReleaseEditor = {
  readonly fields: readonly PlanReleaseFieldDescriptor[];
  readonly catalog: PlanReleaseEditorCatalog;
};

export type PlanReleaseDiagnostic = {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly source: "structural" | "remote-provider";
  readonly evidenceLevel: "credential-free-structural" | "remote-provider-preflight";
  readonly location: { readonly fieldId?: string; readonly path: string };
  readonly message: string;
  readonly recovery: { readonly label: string; readonly actionId?: string; readonly href?: string };
};

export type PlanReleaseSemanticDiff = {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
};
export type PlanReleaseSemanticDiffGroup = {
  readonly group: PlanReleaseSemanticDiffGroupName;
  readonly changes: readonly PlanReleaseSemanticDiff[];
};

export type PlanReleaseImpactAudience =
  | "new-subscriptions"
  | "grandfathered-subscriptions"
  | { readonly cohortId: string };
export type PlanReleaseImpactItem = {
  readonly code: string;
  readonly kind: "fact" | "estimate";
  readonly message: string;
  readonly audience: PlanReleaseImpactAudience;
  readonly references: readonly string[];
  readonly confidence?: "low" | "medium" | "high";
};
export type PlanReleaseImpact = { readonly items: readonly PlanReleaseImpactItem[] };

export type PlanReleaseActionKind = "edit" | "validate" | "review" | "schedule" | "publish";
export type PlanReleaseAdminAction = {
  readonly id: string;
  readonly kind: PlanReleaseActionKind;
  readonly label: string;
  readonly description?: string;
  readonly from: readonly PlanReleaseConsolePhase[];
  readonly to: PlanReleaseConsolePhase;
  readonly permission: string;
  readonly destructive?: boolean;
  readonly requiresActor: boolean;
  readonly requiresReason: boolean;
  readonly requiresIdempotencyKey: boolean;
};
export type PlanReleaseActionRequest = {
  readonly actionId: string;
  readonly expectedReleaseRevision: number;
  readonly actorId?: string;
  readonly reason?: string;
  readonly idempotencyKey?: string;
  readonly scheduledFor?: string;
};
export type PlanReleaseActionDenialReason =
  | "action-id"
  | "transition"
  | "permission"
  | "stale-request"
  | "actor"
  | "reason"
  | "idempotency"
  | "blocking-diagnostics"
  | "stale-review"
  | "schedule-time";
export type PlanReleaseActionValidation =
  | { readonly kind: "allowed" }
  | { readonly kind: "denied"; readonly reasons: readonly PlanReleaseActionDenialReason[] };

export type PlanReleaseOperationalState = {
  readonly snapshot: PlanReleaseConsoleSnapshot;
  readonly editor: PlanReleaseEditor;
  readonly actions: readonly PlanReleaseAdminAction[];
  readonly grantedPermissions: readonly string[];
  readonly diagnostics: readonly PlanReleaseDiagnostic[];
};
type PlanReleaseReviewEvidence = {
  readonly reviewedDraftRevision: number;
  readonly reviewedDefinition: PlanVersionDefinition;
  readonly diff: readonly PlanReleaseSemanticDiffGroup[];
  readonly impact: PlanReleaseImpact;
};

export type PlanReleaseLoadingState = { readonly kind: "loading" };
export type PlanReleaseDraftEditingState = PlanReleaseOperationalState & {
  readonly kind: "draft-editing";
};
export type PlanReleaseValidationState = PlanReleaseOperationalState & {
  readonly kind: "validation";
};
export type PlanReleaseReviewState = PlanReleaseOperationalState &
  PlanReleaseReviewEvidence & { readonly kind: "review" };
export type PlanReleaseSchedulingState = PlanReleaseOperationalState &
  PlanReleaseReviewEvidence & { readonly kind: "scheduling"; readonly scheduledFor: string };
export type PlanReleasePublishingState = PlanReleaseOperationalState &
  PlanReleaseReviewEvidence & { readonly kind: "publishing"; readonly idempotencyKey: string };
export type PlanReleasePublishedReceipt = {
  readonly planVersionRef: PlanVersionDefinition["ref"];
  readonly reviewedDraftRevision: number;
  readonly validationSnapshotId: string;
  readonly actor: { readonly id: string; readonly displayName?: string };
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly publishedAt: string;
};
export type PlanReleasePublishedState = PlanReleaseOperationalState & {
  readonly kind: "published";
  readonly receipt: PlanReleasePublishedReceipt;
};
export type PlanReleaseReadyState =
  | PlanReleaseDraftEditingState
  | PlanReleaseValidationState
  | PlanReleaseReviewState
  | PlanReleaseSchedulingState
  | PlanReleasePublishingState
  | PlanReleasePublishedState;
export type PlanReleaseStaleConflictState = {
  readonly kind: "stale-conflict";
  readonly problem: ProblemDetails;
  readonly localDraft: PlanReleaseDraft;
  readonly latestServerSnapshot: PlanReleaseConsoleSnapshot;
  readonly recoveryActions: readonly PlanReleaseAdminAction[];
};
export type PlanReleaseFailureState = {
  readonly kind: "permission-denied" | "provider-failure" | "problem";
  readonly problem: ProblemDetails;
  readonly snapshot?: PlanReleaseConsoleSnapshot;
  readonly recoveryActions: readonly PlanReleaseAdminAction[];
};
export type PlanReleaseConsoleState =
  | PlanReleaseLoadingState
  | PlanReleaseReadyState
  | PlanReleaseStaleConflictState
  | PlanReleaseFailureState;

export type PlanReleaseEditRequest = {
  readonly descriptorId: string;
  readonly expectedDraftRevision: number;
  readonly value: string | number;
};
export type PlanReleaseEditResult =
  | { readonly kind: "updated"; readonly draft: PlanReleaseDraft }
  | {
      readonly kind: "rejected";
      readonly reason: "unknown-field" | "unknown-catalog-option" | "stale-revision";
    };

export function updatePlanReleaseDraftField(
  draft: PlanReleaseDraft,
  editor: PlanReleaseEditor,
  request: PlanReleaseEditRequest,
): PlanReleaseEditResult {
  if (request.expectedDraftRevision !== draft.revision) {
    return { kind: "rejected", reason: "stale-revision" };
  }
  const descriptor = editor.fields.find((field) => field.id === request.descriptorId);
  if (!descriptor) return { kind: "rejected", reason: "unknown-field" };
  if (
    descriptor.catalog &&
    !editor.catalog[descriptor.catalog].some((option) => option.key === request.value)
  ) {
    return { kind: "rejected", reason: "unknown-catalog-option" };
  }
  const definition = descriptor.write(draft.definition, request.value);
  if (!usesDeclaredCatalogKeys(definition, editor.catalog)) {
    return { kind: "rejected", reason: "unknown-catalog-option" };
  }
  return {
    kind: "updated",
    draft: {
      definition,
      revision: draft.revision + 1,
    },
  };
}

export function isPlanReleaseReviewCurrent(
  state: PlanReleaseReviewState | PlanReleaseSchedulingState | PlanReleasePublishingState,
): boolean {
  return (
    state.reviewedDraftRevision === state.snapshot.candidate.revision &&
    stableStringify(state.reviewedDefinition) ===
      stableStringify(state.snapshot.candidate.definition)
  );
}

export function getAllowedPlanReleaseActions(
  state: PlanReleaseReadyState,
): readonly PlanReleaseAdminAction[] {
  const hasCurrentReview =
    state.kind !== "review" && state.kind !== "scheduling" && state.kind !== "publishing"
      ? true
      : isPlanReleaseReviewCurrent(state);
  const hasBlockingDiagnostics = state.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  );
  return state.actions.filter((action) => {
    const commitsRelease = action.kind === "publish" || action.kind === "schedule";
    const requiresCleanDiagnostics = commitsRelease || action.kind === "review";
    return (
      action.from.includes(state.kind) &&
      state.grantedPermissions.includes(action.permission) &&
      (!requiresCleanDiagnostics || !hasBlockingDiagnostics) &&
      (!commitsRelease || hasCurrentReview)
    );
  });
}

export function validatePlanReleaseActionRequest(input: {
  readonly state: PlanReleaseReadyState;
  readonly action: PlanReleaseAdminAction;
  readonly request: PlanReleaseActionRequest;
}): PlanReleaseActionValidation {
  const reasons: PlanReleaseActionDenialReason[] = [];
  const { action, request, state } = input;
  const commitsRelease = action.kind === "publish" || action.kind === "schedule";
  const requiresCleanDiagnostics = commitsRelease || action.kind === "review";
  if (request.actionId !== action.id) reasons.push("action-id");
  if (!action.from.includes(state.kind)) reasons.push("transition");
  if (!state.grantedPermissions.includes(action.permission)) reasons.push("permission");
  if (request.expectedReleaseRevision !== state.snapshot.releaseRevision) {
    reasons.push("stale-request");
  }
  if ((commitsRelease || action.requiresActor) && !request.actorId?.trim()) reasons.push("actor");
  if ((commitsRelease || action.requiresReason) && !request.reason?.trim()) reasons.push("reason");
  if ((commitsRelease || action.requiresIdempotencyKey) && !request.idempotencyKey?.trim()) {
    reasons.push("idempotency");
  }
  if (
    action.kind === "schedule" &&
    request.scheduledFor !== state.snapshot.candidate.definition.effectiveAt
  ) {
    reasons.push("schedule-time");
  }
  if (
    requiresCleanDiagnostics &&
    state.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  ) {
    reasons.push("blocking-diagnostics");
  }
  if (
    commitsRelease &&
    (state.kind === "review" || state.kind === "scheduling" || state.kind === "publishing") &&
    !isPlanReleaseReviewCurrent(state)
  ) {
    reasons.push("stale-review");
  }
  return reasons.length === 0 ? { kind: "allowed" } : { kind: "denied", reasons };
}

export function createPlanReleaseSemanticDiffGroups(
  current: PlanVersionDefinition | null,
  candidate: PlanVersionDefinition,
): readonly PlanReleaseSemanticDiffGroup[] {
  const definitions: readonly {
    readonly group: PlanReleaseSemanticDiffGroupName;
    readonly fields: readonly {
      readonly field: string;
      readonly read: (definition: PlanVersionDefinition) => unknown;
    }[];
  }[] = [
    {
      group: "price",
      fields: [
        { field: "recurring price", read: (value) => value.amount },
        { field: "currency", read: (value) => value.currency },
        { field: "interval", read: (value) => value.interval },
        { field: "intervalCount", read: (value) => value.intervalCount },
      ],
    },
    {
      group: "seats",
      fields: [
        { field: "seat price", read: (value) => value.seatUnitAmount },
        { field: "included seats", read: (value) => value.quantityPolicy.includedSeats },
        { field: "minimum seats", read: (value) => value.quantityPolicy.minimumQuantity },
        { field: "seat quota", read: (value) => value.quantityPolicy.seatQuota },
        {
          field: "billable roles",
          read: (value) => [...value.quantityPolicy.billableMembershipRoles].sort(),
        },
      ],
    },
    {
      group: "usage",
      fields: [{ field: "usage tiers", read: (value) => normalizedUsageTiers(value) }],
    },
    {
      group: "entitlements",
      fields: [{ field: "entitlements", read: (value) => normalizedEntitlements(value) }],
    },
    { group: "trial", fields: [{ field: "trial", read: (value) => value.trial }] },
    {
      group: "provider",
      fields: [
        { field: "rating mode", read: (value) => value.rating },
        { field: "provider bindings", read: (value) => normalizedProviderBindings(value) },
      ],
    },
    {
      group: "effective-time",
      fields: [
        { field: "effectiveAt", read: (value) => value.effectiveAt },
        { field: "effectiveUntil", read: (value) => value.effectiveUntil },
      ],
    },
  ];
  return definitions
    .map(({ fields, group }) => ({
      group,
      changes: fields
        .map(({ field, read }) => ({
          after: read(candidate),
          before: current ? read(current) : undefined,
          field,
        }))
        .filter((change) => stableStringify(change.before) !== stableStringify(change.after)),
    }))
    .filter((group) => group.changes.length > 0);
}

export function createPlanReleaseConsoleSnapshot(
  release: PlanRelease,
  currentPublished: PlanVersionDefinition | null,
): PlanReleaseConsoleSnapshot {
  const reviewedDraftRevision =
    release.review?.reviewedDraftRevision ??
    release.publicationIntent?.reviewedDraftRevision ??
    release.publication?.reviewedDraftRevision;
  return {
    candidate: {
      definition: release.definition,
      revision: reviewedDraftRevision ?? release.revision,
    },
    currentPublished,
    releaseRevision: release.revision,
  };
}

function usesDeclaredCatalogKeys(
  definition: PlanVersionDefinition,
  catalog: PlanReleaseEditorCatalog,
): boolean {
  const declaredMeters = new Set(catalog.meters.map(({ key }) => key));
  const declaredEntitlements = new Set(catalog.entitlements.map(({ key }) => key));
  const declaredProviders = new Set(catalog.providers.map(({ key }) => key));
  const declaredProducts = new Set(catalog.providerProducts.map(({ key }) => key));
  const declaredPrices = new Set(catalog.providerPrices.map(({ key }) => key));
  const declaredProviderMeters = new Set(catalog.providerMeters.map(({ key }) => key));
  return (
    (definition.usageTiers ?? []).every(({ meterKey }) => declaredMeters.has(meterKey)) &&
    (definition.entitlements ?? []).every(
      (entitlement) =>
        declaredEntitlements.has(entitlement.featureKey) &&
        (entitlement.type !== "metered" || declaredMeters.has(entitlement.meterKey)),
    ) &&
    definition.providerBindings.every(
      ({ meterBindings, priceIds, productId, provider }) =>
        declaredProviders.has(provider) &&
        declaredProducts.has(productId) &&
        priceIds.every((priceId) => declaredPrices.has(priceId)) &&
        (meterBindings ?? []).every(
          ({ meterId, meterKey }) =>
            declaredMeters.has(meterKey) && declaredProviderMeters.has(meterId),
        ),
    ) &&
    (definition.rating.mode !== "provider" || declaredProviders.has(definition.rating.provider))
  );
}

function normalizedUsageTiers(definition: PlanVersionDefinition): readonly unknown[] {
  return [...(definition.usageTiers ?? [])]
    .map(({ meterKey, unitAmount, upTo }) => ({ meterKey, unitAmount, upTo }))
    .sort((left, right) => {
      const meter = left.meterKey.localeCompare(right.meterKey);
      if (meter !== 0) return meter;
      const boundary =
        (left.upTo ?? Number.POSITIVE_INFINITY) - (right.upTo ?? Number.POSITIVE_INFINITY);
      return boundary !== 0 ? boundary : left.unitAmount - right.unitAmount;
    });
}

function normalizedEntitlements(definition: PlanVersionDefinition): readonly unknown[] {
  return [...(definition.entitlements ?? [])]
    .map((entitlement) => ({ ...entitlement }))
    .sort((left, right) => left.featureKey.localeCompare(right.featureKey));
}

function normalizedProviderBindings(definition: PlanVersionDefinition): readonly unknown[] {
  return definition.providerBindings
    .map((binding) => ({
      meterBindings: [...(binding.meterBindings ?? [])].sort((left, right) =>
        left.meterKey.localeCompare(right.meterKey),
      ),
      priceIds: [...new Set(binding.priceIds)].sort(),
      productId: binding.productId,
      provider: binding.provider,
    }))
    .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
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
