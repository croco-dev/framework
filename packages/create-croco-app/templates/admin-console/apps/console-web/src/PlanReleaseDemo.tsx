import { useMemo, useState } from "react";
import type { ComponentProps } from "react";

import {
  createPlanReleaseSemanticDiffGroups,
  PlanReleaseConsole,
  updatePlanReleaseDraftField,
} from "@croco/admin-react";
import type {
  PlanReleaseAdminAction,
  PlanReleaseConsoleSnapshot,
  PlanReleaseConsoleState,
  PlanReleaseDiagnostic,
  PlanReleaseDraft,
  PlanReleaseEditor,
  PlanReleaseImpact,
} from "@croco/admin-react";
import type { PlanVersionDefinition } from "@croco/billing-core";

type DemoScenario =
  | "draft"
  | "validation"
  | "review"
  | "blocked-publish"
  | "corrected-publish"
  | "scheduled-publish";

const currentPublished = definition({
  amount: 9_900,
  effectiveAt: "2026-01-01T00:00:00.000Z",
  ref: planRef("pro@2026-01"),
  versionId: "2026-01",
});

const initialCandidate: PlanReleaseDraft = {
  definition: definition(),
  revision: 3,
};

const editor: PlanReleaseEditor = {
  catalog: {
    entitlements: [
      { key: "analytics", label: "Analytics" },
      { key: "audit-log", label: "Audit log" },
    ],
    meters: [
      { key: "api.calls", label: "API calls" },
      { key: "storage.bytes", label: "Storage bytes" },
    ],
    pricing: [{ key: "recurring", label: "Recurring price" }],
    providerMeters: [{ key: "fake-api-calls", label: "Fake API calls meter" }],
    providerPrices: [{ key: "fake-recurring", label: "Fake recurring price" }],
    providerProducts: [{ key: "fake-pro", label: "Fake Pro product" }],
    providers: [
      { key: "fake-polar", label: "Fake Polar" },
      { key: "fake-stripe", label: "Fake Stripe" },
    ],
  },
  fields: [
    {
      group: "price",
      id: "pricing-component",
      input: "select",
      label: "Pricing component",
      catalog: "pricing",
      read: () => "recurring",
      write: (value) => value,
    },
    {
      group: "price",
      id: "recurring-price",
      input: "number",
      label: "Recurring price (minor units)",
      read: (value) => value.amount,
      write: (value, amount) => ({ ...value, amount: Number(amount) }),
    },
    {
      catalog: "meters",
      group: "usage",
      id: "meter-key",
      input: "select",
      label: "Usage meter",
      read: (value) => value.usageTiers?.[0]?.meterKey ?? "api.calls",
      write: (value, meterKey) => ({
        ...value,
        usageTiers: [{ meterKey: String(meterKey), unitAmount: 2, upTo: null }],
      }),
    },
    {
      catalog: "entitlements",
      group: "entitlements",
      id: "entitlement-key",
      input: "select",
      label: "Included entitlement",
      read: (value) => value.entitlements?.[0]?.featureKey ?? "analytics",
      write: (value, featureKey) => ({
        ...value,
        entitlements: [{ featureKey: String(featureKey), type: "boolean" }],
      }),
    },
    {
      catalog: "providers",
      group: "provider",
      id: "provider-binding",
      input: "select",
      label: "Provider binding",
      read: (value) => value.providerBindings[0]?.provider ?? "fake-polar",
      write: (value, provider) => ({
        ...value,
        providerBindings: [
          {
            meterBindings: [{ meterId: "fake-api-calls", meterKey: "api.calls" }],
            priceIds: ["fake-recurring"],
            productId: "fake-pro",
            provider: String(provider),
          },
        ],
        rating: { mode: "provider", provider: String(provider) },
      }),
    },
    {
      group: "effective-time",
      id: "effective-at",
      input: "datetime-local",
      label: "Effective time",
      read: (value) => value.effectiveAt.slice(0, 16),
      write: (value, effectiveAt) => ({
        ...value,
        effectiveAt: normalizeEffectiveTime(effectiveAt),
      }),
    },
  ],
};

const actions: readonly PlanReleaseAdminAction[] = [
  action("edit", "Return to draft", ["review", "validation"], "draft-editing", false),
  action("validate", "Validate draft", ["draft-editing"], "validation", false),
  action("review", "Approve exact draft revision", ["validation"], "review", false),
  action("publish", "Publish reviewed version", ["review"], "publishing", true),
  action("schedule", "Schedule reviewed version", ["review"], "scheduling", true),
];

const structuralNotice: PlanReleaseDiagnostic = {
  code: "CROCO_BILLING_GRAPH_VERIFIED",
  evidenceLevel: "credential-free-structural",
  location: { fieldId: "meter-key", path: "plan.usageTiers[0].meterKey" },
  message: "The selected meter is declared in the generated ContractGraph fixture.",
  recovery: { label: "No recovery required" },
  severity: "warning",
  source: "structural",
};

const remoteWarning: PlanReleaseDiagnostic = {
  code: "FAKE_PROVIDER_PRICE_PENDING",
  evidenceLevel: "remote-provider-preflight",
  location: { fieldId: "provider-binding", path: "plan.providerBindings[0]" },
  message: "The fake provider preflight reports a pending price sync.",
  recovery: { label: "Wait for the fake sync or publish after operator review" },
  severity: "warning",
  source: "remote-provider",
};

const remoteError: PlanReleaseDiagnostic = {
  ...remoteWarning,
  code: "FAKE_PROVIDER_PRICE_MISSING",
  message: "The fake provider cannot publish until a synchronized provider binding is selected.",
  recovery: { actionId: "edit", label: "Return to draft and select Fake Stripe" },
  severity: "error",
};

const invalidEffectiveTime: PlanReleaseDiagnostic = {
  code: "CROCO_BILLING_EFFECTIVE_TIME_INVALID",
  evidenceLevel: "credential-free-structural",
  location: { fieldId: "effective-at", path: "plan.effectiveAt" },
  message: "Choose a valid effective time before this draft can be reviewed.",
  recovery: { actionId: "edit", label: "Return to draft and choose an effective time" },
  severity: "error",
  source: "structural",
};

const impact: PlanReleaseImpact = {
  items: [
    {
      audience: "new-subscriptions",
      code: "new-price-applies",
      kind: "fact",
      message: "New subscriptions receive the immutable 2027-01 version.",
      references: ["pro@2027-01"],
    },
    {
      audience: "grandfathered-subscriptions",
      code: "grandfathered-unchanged",
      kind: "fact",
      message: "Existing subscriptions remain on their current version.",
      references: ["pro@2026-01"],
    },
    {
      audience: { cohortId: "fake-selected-migration" },
      code: "estimated-upgrade-count",
      confidence: "medium",
      kind: "estimate",
      message: "The fake provider estimates 12 selected migrations.",
      references: ["fake-provider-preflight-1"],
    },
  ],
};

export function PlanReleaseDemo() {
  const [scenario, setScenario] = useState<DemoScenario>("draft");
  const [candidate, setCandidate] = useState(initialCandidate);
  const [pendingActionId, setPendingActionId] = useState<string>();
  const state = useMemo(() => createScenarioState(scenario, candidate), [candidate, scenario]);
  const command = {
    actorId: "generated-operator",
    idempotencyKey: `plan-release-${scenario}`,
    reason: `Demonstrate ${scenario} with fake providers`,
    scheduledFor: "2027-01-01T00:00:00.000Z",
  };
  const handleAction: NonNullable<ComponentProps<typeof PlanReleaseConsole>["onAction"]> = (
    selected,
  ) => {
    setPendingActionId(undefined);
    if (selected.kind === "edit") setScenario("draft");
    if (selected.kind === "validate") setScenario("validation");
    if (selected.kind === "review") {
      setScenario(hasCorrectedProviderBinding(candidate) ? "review" : "blocked-publish");
    }
    if (selected.kind === "publish") setScenario("corrected-publish");
    if (selected.kind === "schedule") setScenario("scheduled-publish");
  };
  const handleEdit: NonNullable<ComponentProps<typeof PlanReleaseConsole>["onEdit"]> = (
    request,
  ) => {
    const result = updatePlanReleaseDraftField(candidate, editor, request);
    if (result.kind === "updated") {
      setCandidate(result.draft);
      setScenario("draft");
    }
  };
  const handleReset = () => {
    setCandidate(initialCandidate);
    setPendingActionId(undefined);
    setScenario("draft");
  };

  return (
    <section aria-label="Generated monetization plan release example">
      <h2>Monetization plan release</h2>
      <p>
        This zero-credential fixture separates credential-free-structural validation from
        remote-provider-preflight evidence.
      </p>
      <p aria-live="polite">Fake workflow state: {scenario}</p>
      <button onClick={handleReset} type="button">
        Reset plan release workflow
      </button>
      <PlanReleaseConsole
        command={command}
        onAction={handleAction}
        onCancelConfirmation={() => setPendingActionId(undefined)}
        onEdit={handleEdit}
        onRequestConfirmation={(selected) => setPendingActionId(selected.id)}
        pendingConfirmationActionId={pendingActionId}
        state={state}
      />
    </section>
  );
}

function createScenarioState(
  scenario: DemoScenario,
  candidate: PlanReleaseDraft,
): PlanReleaseConsoleState {
  const snapshot: PlanReleaseConsoleSnapshot = {
    candidate,
    currentPublished,
    releaseRevision: scenario === "draft" ? candidate.revision : candidate.revision + 1,
  };
  const base = {
    actions,
    diagnostics:
      scenario === "blocked-publish"
        ? [remoteError]
        : scenario === "validation"
          ? [
              structuralNotice,
              ...(Number.isNaN(Date.parse(candidate.definition.effectiveAt))
                ? [invalidEffectiveTime]
                : [remoteWarning]),
            ]
          : [],
    editor,
    grantedPermissions: ["plans:read", "plans:write", "plans:publish"],
    snapshot,
  };
  const review = {
    diff: createPlanReleaseSemanticDiffGroups(currentPublished, candidate.definition),
    impact,
    reviewedDefinition: candidate.definition,
    reviewedDraftRevision: candidate.revision,
  };

  if (scenario === "draft") return { ...base, diagnostics: [], kind: "draft-editing" };
  if (scenario === "validation") return { ...base, kind: "validation" };
  if (scenario === "review" || scenario === "blocked-publish") {
    return { ...base, ...review, kind: "review" };
  }
  if (scenario === "scheduled-publish") {
    return {
      ...base,
      ...review,
      kind: "scheduling",
      scheduledFor: "2027-01-01T00:00:00.000Z",
    };
  }
  return {
    ...base,
    kind: "published",
    receipt: {
      actor: { id: "generated-operator", displayName: "Generated operator" },
      idempotencyKey: "plan-release-corrected-publish",
      planVersionRef: candidate.definition.ref,
      publishedAt: "2026-12-15T09:00:00.000Z",
      reason: "Publish corrected fake-provider binding",
      reviewedDraftRevision: candidate.revision,
      validationSnapshotId: "fake-contract-graph-snapshot-2",
    },
  };
}

function hasCorrectedProviderBinding(candidate: PlanReleaseDraft): boolean {
  return candidate.definition.providerBindings[0]?.provider === "fake-stripe";
}

function action(
  kind: PlanReleaseAdminAction["kind"],
  label: string,
  from: PlanReleaseAdminAction["from"],
  to: PlanReleaseAdminAction["to"],
  destructive: boolean,
): PlanReleaseAdminAction {
  return {
    destructive,
    from,
    id: kind,
    kind,
    label,
    permission: kind === "publish" || kind === "schedule" ? "plans:publish" : "plans:write",
    requiresActor: true,
    requiresIdempotencyKey: kind === "publish" || kind === "schedule",
    requiresReason: kind === "publish" || kind === "schedule",
    to,
  };
}

function definition(overrides: Partial<PlanVersionDefinition> = {}): PlanVersionDefinition {
  return {
    amount: 12_900,
    currency: "USD",
    effectiveAt: "2027-01-01T00:00:00.000Z",
    entitlements: [{ featureKey: "analytics", type: "boolean" }],
    interval: "month",
    intervalCount: 1,
    name: "Pro",
    planId: "pro",
    providerBindings: [
      {
        meterBindings: [{ meterId: "fake-api-calls", meterKey: "api.calls" }],
        priceIds: ["fake-recurring"],
        productId: "fake-pro",
        provider: "fake-polar",
      },
    ],
    quantityPolicy: {
      billableMembershipRoles: ["owner", "admin", "member"],
      includedSeats: 5,
      minimumQuantity: 1,
      seatQuota: 100,
    },
    rating: { mode: "provider", provider: "fake-polar" },
    ref: planRef("pro@2027-01"),
    seatUnitAmount: 1_500,
    trial: { days: 14, requiresPaymentMethod: true },
    usageTiers: [{ meterKey: "api.calls", unitAmount: 2, upTo: null }],
    versionId: "2027-01",
    ...overrides,
  };
}

function planRef(value: string): PlanVersionDefinition["ref"] {
  return value as PlanVersionDefinition["ref"];
}

function normalizeEffectiveTime(value: unknown): string {
  const effectiveAt = String(value);
  const timestamp = Date.parse(effectiveAt);
  return Number.isNaN(timestamp) ? effectiveAt : new Date(timestamp).toISOString();
}
