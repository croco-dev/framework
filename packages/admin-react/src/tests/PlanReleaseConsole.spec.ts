import type { PlanRelease, PlanVersionDefinition } from "@croco/billing-core";
import type { ProblemDetails } from "@croco/problems-core";
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createPlanReleaseSemanticDiffGroups,
  createPlanReleaseConsoleSnapshot,
  getAllowedPlanReleaseActions,
  isPlanReleaseReviewCurrent,
  PlanReleaseConsole,
  updatePlanReleaseDraftField,
  validatePlanReleaseActionRequest,
} from "../index";
import type {
  PlanReleaseAdminAction,
  PlanReleaseConsoleState,
  PlanReleaseEditor,
  PlanReleaseReviewState,
} from "../index";

const current = definition("basic@1", 1_000);
const candidate = {
  ...definition("basic@2", 1_500),
  effectiveAt: "2026-09-01T00:00:00.000Z",
  entitlements: [{ featureKey: "analytics", type: "boolean" as const }],
  providerBindings: [{ priceIds: ["price-v2"], productId: "product", provider: "stripe" }],
  rating: { mode: "provider" as const, provider: "stripe" },
  quantityPolicy: {
    billableMembershipRoles: ["owner", "admin"] as const,
    includedSeats: 3,
    minimumQuantity: 1,
    seatQuota: 20,
  },
  seatUnitAmount: 250,
  trial: { days: 14, requiresPaymentMethod: true },
  usageTiers: [{ meterKey: "api.calls", unitAmount: 2, upTo: null }],
};

const editor: PlanReleaseEditor = {
  catalog: {
    entitlements: [{ key: "analytics", label: "Analytics" }],
    meters: [{ key: "api.calls", label: "API calls" }],
    pricing: [{ key: "standard", label: "Standard pricing" }],
    providerMeters: [{ key: "meter-api-calls", label: "Provider API calls meter" }],
    providerPrices: [{ key: "price-v2", label: "Version 2 price" }],
    providerProducts: [{ key: "product", label: "Product" }],
    providers: [{ key: "stripe", label: "Stripe" }],
  },
  fields: [
    {
      group: "price",
      id: "amount",
      input: "number",
      label: "Recurring amount",
      read: (value) => value.amount,
      write: (value, amount) => ({ ...value, amount: Number(amount) }),
    },
    {
      catalog: "providers",
      group: "provider",
      id: "provider",
      input: "select",
      label: "Provider",
      read: (value) => value.providerBindings[0]?.provider ?? "",
      write: (value, provider) => ({
        ...value,
        providerBindings: value.providerBindings.map((binding, index) =>
          index === 0 ? { ...binding, provider: String(provider) } : binding,
        ),
      }),
    },
  ],
};

const publishAction: PlanReleaseAdminAction = {
  destructive: true,
  from: ["review"],
  id: "publish-release",
  kind: "publish",
  label: "Publish",
  permission: "plans:publish",
  requiresActor: true,
  requiresIdempotencyKey: true,
  requiresReason: true,
  to: "publishing",
};

const scheduleAction: PlanReleaseAdminAction = {
  ...publishAction,
  id: "schedule-release",
  kind: "schedule",
  label: "Schedule",
  requiresIdempotencyKey: true,
  to: "scheduling",
};

const editAction: PlanReleaseAdminAction = {
  from: ["review"],
  id: "return-to-draft",
  kind: "edit",
  label: "Return to draft",
  permission: "plans:write",
  requiresActor: true,
  requiresIdempotencyKey: false,
  requiresReason: false,
  to: "draft-editing",
};

const problem: ProblemDetails = {
  code: "billing/plan-release-failed",
  detail: "The repository rejected the release.",
  status: 409,
  title: "Plan release failed",
  type: "https://croco.dev/problems/plan-release-failed",
};

function definition(ref: string, amount: number): PlanVersionDefinition {
  return {
    amount,
    currency: "USD",
    effectiveAt: "2026-08-01T00:00:00.000Z",
    interval: "month",
    intervalCount: 1,
    name: "Basic",
    planId: "basic",
    providerBindings: [],
    quantityPolicy: {
      billableMembershipRoles: ["owner"],
      includedSeats: 1,
      minimumQuantity: 1,
      seatQuota: 10,
    },
    rating: { mode: "croco" },
    ref: ref as PlanVersionDefinition["ref"],
    versionId: ref.split("@")[1] ?? ref,
  };
}

function reviewState(overrides: Partial<PlanReleaseReviewState> = {}): PlanReleaseReviewState {
  return {
    actions: [publishAction, scheduleAction],
    diagnostics: [],
    diff: createPlanReleaseSemanticDiffGroups(current, candidate),
    editor,
    grantedPermissions: ["plans:publish", "plans:write"],
    impact: {
      items: [
        {
          audience: "grandfathered-subscriptions",
          code: "grandfathered-unchanged",
          kind: "fact",
          message: "Existing subscriptions retain their price.",
          references: ["policy:grandfathering"],
        },
        {
          audience: { cohortId: "migration-2026-q3" },
          code: "migration-cost",
          confidence: "medium",
          kind: "estimate",
          message: "The cohort cost may increase by 8%.",
          references: ["cohort:migration-2026-q3"],
        },
      ],
    },
    kind: "review",
    reviewedDefinition: candidate,
    reviewedDraftRevision: 2,
    snapshot: {
      candidate: { definition: candidate, revision: 2 },
      currentPublished: current,
      releaseRevision: 3,
    },
    ...overrides,
  };
}

function render(state: PlanReleaseConsoleState, props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(createElement(PlanReleaseConsole, { ...props, state }));
}

describe("PlanReleaseConsole contracts", () => {
  it("groups semantic changes into stable domain groups", () => {
    expect(
      createPlanReleaseSemanticDiffGroups(current, candidate).map((group) => group.group),
    ).toEqual(["price", "seats", "usage", "entitlements", "trial", "provider", "effective-time"]);
  });

  it("only edits code-declared fields and catalog options with revision CAS", () => {
    const draft = { definition: candidate, revision: 2 };
    expect(
      updatePlanReleaseDraftField(draft, editor, {
        descriptorId: "meter",
        expectedDraftRevision: 2,
        value: "unknown-meter",
      }),
    ).toEqual({ kind: "rejected", reason: "unknown-field" });
    expect(
      updatePlanReleaseDraftField(draft, editor, {
        descriptorId: "provider",
        expectedDraftRevision: 2,
        value: "unknown-provider",
      }),
    ).toEqual({ kind: "rejected", reason: "unknown-catalog-option" });
    expect(
      updatePlanReleaseDraftField(draft, editor, {
        descriptorId: "amount",
        expectedDraftRevision: 1,
        value: 2_000,
      }),
    ).toEqual({ kind: "rejected", reason: "stale-revision" });

    const result = updatePlanReleaseDraftField(draft, editor, {
      descriptorId: "amount",
      expectedDraftRevision: 2,
      value: 2_000,
    });
    expect(result.kind).toBe("updated");
    if (result.kind === "updated") {
      expect(result.draft.revision).toBe(3);
      expect(result.draft.definition.amount).toBe(2_000);
      expect(
        isPlanReleaseReviewCurrent(
          reviewState({
            snapshot: { candidate: result.draft, currentPublished: current, releaseRevision: 3 },
          }),
        ),
      ).toBe(false);
    }
  });

  it("requires permission, actor, reason, idempotency, schedule time, current review, and clean diagnostics", () => {
    const state = reviewState({
      diagnostics: [
        {
          code: "provider-price-missing",
          evidenceLevel: "remote-provider-preflight",
          location: { path: "/providerBindings/0/priceIds" },
          message: "Provider price is missing.",
          recovery: { label: "Create a provider price and validate again." },
          severity: "error",
          source: "remote-provider",
        },
      ],
      grantedPermissions: [],
      reviewedDraftRevision: 1,
    });
    expect(getAllowedPlanReleaseActions(state)).toEqual([]);
    expect(
      validatePlanReleaseActionRequest({
        action: scheduleAction,
        request: { actionId: scheduleAction.id, expectedReleaseRevision: 2 },
        state,
      }),
    ).toEqual({
      kind: "denied",
      reasons: [
        "permission",
        "stale-request",
        "actor",
        "reason",
        "idempotency",
        "schedule-time",
        "blocking-diagnostics",
        "stale-review",
      ],
    });
  });

  it("keeps release CAS separate from the reviewed draft revision", () => {
    const release: PlanRelease = {
      definition: candidate,
      history: [],
      ref: candidate.ref,
      review: {
        actor: { id: "reviewer" },
        impact: {
          audience: "new_subscriptions",
          calculatedFacts: [],
          estimates: [],
          providerCapabilitiesRequired: [],
          providerPreflightFacts: [],
        },
        reason: "Approve",
        reviewedAt: "2026-08-09T00:00:00.000Z",
        reviewedDefinition: candidate,
        reviewedDraftRevision: 2,
        semanticDiff: [],
        validation: {
          checkedAt: "2026-08-09T00:00:00.000Z",
          definitionFingerprint: "sha256:reviewed",
          diagnostics: [],
          draftRevision: 2,
          graphVersion: "graph-1",
          planVersionRef: candidate.ref,
          snapshotId: "validation-1",
        },
      },
      revision: 3,
      state: "in_review",
    };
    const snapshot = createPlanReleaseConsoleSnapshot(release, current);
    expect(snapshot).toMatchObject({ releaseRevision: 3, candidate: { revision: 2 } });
    const state = reviewState({ snapshot });
    expect(isPlanReleaseReviewCurrent(state)).toBe(true);
    expect(
      validatePlanReleaseActionRequest({
        action: publishAction,
        request: {
          actionId: publishAction.id,
          actorId: "operator",
          expectedReleaseRevision: 3,
          idempotencyKey: "publish-3",
          reason: "Approved",
        },
        state,
      }),
    ).toEqual({ kind: "allowed" });
  });

  it("preserves return-to-draft recovery when review evidence is stale", () => {
    const state = reviewState({
      actions: [editAction, publishAction],
      reviewedDraftRevision: 1,
    });
    expect(getAllowedPlanReleaseActions(state)).toEqual([editAction]);
    expect(
      validatePlanReleaseActionRequest({
        action: editAction,
        request: {
          actionId: editAction.id,
          actorId: "operator",
          expectedReleaseRevision: 3,
        },
        state,
      }),
    ).toEqual({ kind: "allowed" });
  });

  it("binds the action identity and schedule time to the reviewed candidate", () => {
    const state = reviewState();
    expect(
      validatePlanReleaseActionRequest({
        action: scheduleAction,
        request: {
          actionId: publishAction.id,
          actorId: "operator",
          expectedReleaseRevision: 3,
          idempotencyKey: "schedule-3",
          reason: "Approved",
          scheduledFor: "2026-10-01T00:00:00.000Z",
        },
        state,
      }),
    ).toEqual({ kind: "denied", reasons: ["action-id", "schedule-time"] });
  });

  it("rejects protected catalog keys injected by unrestricted field writers", () => {
    const injections: readonly PlanReleaseEditor["fields"][number][] = [
      {
        group: "usage",
        id: "hostile-meter",
        input: "text",
        label: "Hostile meter",
        read: () => "",
        write: (value) => ({
          ...value,
          usageTiers: [{ meterKey: "unknown-meter", unitAmount: 1, upTo: null }],
        }),
      },
      {
        group: "entitlements",
        id: "hostile-entitlement",
        input: "text",
        label: "Hostile entitlement",
        read: () => "",
        write: (value) => ({
          ...value,
          entitlements: [{ featureKey: "unknown-entitlement", type: "boolean" }],
        }),
      },
      {
        group: "entitlements",
        id: "hostile-entitlement-meter",
        input: "text",
        label: "Hostile entitlement meter",
        read: () => "",
        write: (value) => ({
          ...value,
          entitlements: [
            {
              featureKey: "analytics",
              meterKey: "unknown-meter",
              overagePolicy: "BLOCK",
              quota: 10,
              type: "metered",
            },
          ],
        }),
      },
      {
        group: "provider",
        id: "hostile-provider",
        input: "text",
        label: "Hostile provider",
        read: () => "",
        write: (value) => ({
          ...value,
          providerBindings: [{ priceIds: [], productId: "product", provider: "unknown-provider" }],
        }),
      },
      {
        group: "provider",
        id: "hostile-product",
        input: "text",
        label: "Hostile product",
        read: () => "",
        write: (value) => ({
          ...value,
          providerBindings: [
            { priceIds: ["price-v2"], productId: "unknown-product", provider: "stripe" },
          ],
        }),
      },
      {
        group: "provider",
        id: "hostile-price",
        input: "text",
        label: "Hostile price",
        read: () => "",
        write: (value) => ({
          ...value,
          providerBindings: [
            { priceIds: ["unknown-price"], productId: "product", provider: "stripe" },
          ],
        }),
      },
      {
        group: "provider",
        id: "hostile-provider-meter",
        input: "text",
        label: "Hostile provider meter",
        read: () => "",
        write: (value) => ({
          ...value,
          providerBindings: [
            {
              meterBindings: [{ meterId: "unknown-provider-meter", meterKey: "api.calls" }],
              priceIds: ["price-v2"],
              productId: "product",
              provider: "stripe",
            },
          ],
        }),
      },
    ];
    for (const descriptor of injections) {
      expect(
        updatePlanReleaseDraftField(
          { definition: candidate, revision: 2 },
          { ...editor, fields: [descriptor] },
          { descriptorId: descriptor.id, expectedDraftRevision: 2, value: "attack" },
        ),
      ).toEqual({ kind: "rejected", reason: "unknown-catalog-option" });
    }
    const pricingEditor: PlanReleaseEditor = {
      ...editor,
      fields: [
        {
          catalog: "pricing",
          group: "price",
          id: "pricing-component",
          input: "select",
          label: "Pricing component",
          read: () => "standard",
          write: (value) => value,
        },
      ],
    };
    expect(
      updatePlanReleaseDraftField({ definition: candidate, revision: 2 }, pricingEditor, {
        descriptorId: "pricing-component",
        expectedDraftRevision: 2,
        value: "unknown-price",
      }),
    ).toEqual({ kind: "rejected", reason: "unknown-catalog-option" });
  });

  it("ignores domain-order-only changes in semantic review", () => {
    const reordered = {
      ...candidate,
      quantityPolicy: {
        ...candidate.quantityPolicy,
        billableMembershipRoles: ["admin", "owner"] as const,
      },
    };
    expect(createPlanReleaseSemanticDiffGroups(candidate, reordered)).toEqual([]);
  });
});

describe("PlanReleaseConsole rendering", () => {
  it("renders loading, editing, validation, scheduling, publishing, and published states explicitly", () => {
    expect(render({ kind: "loading" })).toContain('data-state="loading"');
    const base = reviewState();
    expect(render({ ...base, kind: "draft-editing" })).toContain(
      'aria-label="Structured plan editor"',
    );
    expect(render({ ...base, kind: "draft-editing" })).toContain(
      'aria-label="Plan family versions"',
    );
    expect(render({ ...base, kind: "draft-editing" })).toContain('data-status="published"');
    expect(render({ ...base, kind: "draft-editing" })).toContain('data-status="draft-editing"');
    expect(render({ ...base, kind: "validation" })).toContain('aria-busy="true"');
    expect(
      render({ ...base, kind: "scheduling", scheduledFor: "2026-09-01T00:00:00.000Z" }),
    ).toContain("Scheduled for 2026-09-01T00:00:00.000Z");
    expect(render({ ...base, idempotencyKey: "publish-1", kind: "publishing" })).toContain(
      "Publication is in progress.",
    );
    const published = render({
      ...base,
      kind: "published",
      receipt: {
        actor: { displayName: "Release Operator", id: "operator-1" },
        idempotencyKey: "publish-1",
        planVersionRef: candidate.ref,
        publishedAt: "2026-09-01T00:00:00.000Z",
        reason: "Approved rollout",
        reviewedDraftRevision: 2,
        validationSnapshotId: "validation-1",
      },
    });
    expect(published).toContain("The candidate is published.");
    expect(published).toContain('aria-label="Published release receipt"');
    expect(published).toContain("Release Operator");
    expect(published).toContain("validation-1");
  });

  it("renders structural and provider diagnostics plus fact and estimate audiences", () => {
    const html = render(
      reviewState({
        diagnostics: [
          {
            code: "invalid-seat-floor",
            evidenceLevel: "credential-free-structural",
            location: { fieldId: "includedSeats", path: "/quantityPolicy/includedSeats" },
            message: "Included seats exceed the quota.",
            recovery: { label: "Reduce included seats." },
            severity: "warning",
            source: "structural",
          },
          {
            code: "provider-price-missing",
            evidenceLevel: "remote-provider-preflight",
            location: { path: "/providerBindings/0/priceIds" },
            message: "Provider price is missing.",
            recovery: {
              href: "https://provider.example.test/prices",
              label: "Create the price and validate again.",
            },
            severity: "error",
            source: "remote-provider",
          },
        ],
      }),
    );
    expect(html).toContain('data-source="structural"');
    expect(html).toContain('data-source="remote-provider"');
    expect(html).toContain('href="https://provider.example.test/prices"');
    expect(html).toContain("Evidence: credential-free-structural");
    expect(html).toContain("Evidence: remote-provider-preflight");
    expect(html).toContain("Reduce included seats.");
    expect(html).toContain('data-impact-kind="fact"');
    expect(html).toContain("Audience: grandfathered-subscriptions");
    expect(html).toContain('data-impact-kind="estimate"');
    expect(html).toContain("Audience: cohort:migration-2026-q3");
    expect(html).toContain("Confidence: medium");
  });

  it("renders provider, repository/domain Problem, permission, and stale conflict evidence", () => {
    for (const kind of ["permission-denied", "provider-failure", "problem"] as const) {
      expect(render({ kind, problem, recoveryActions: [] })).toContain(
        "billing/plan-release-failed",
      );
    }
    const stale = render({
      kind: "stale-conflict",
      latestServerSnapshot: {
        candidate: { definition: candidate, revision: 4 },
        currentPublished: current,
        releaseRevision: 5,
      },
      localDraft: { definition: candidate, revision: 2 },
      problem,
      recoveryActions: [],
    });
    expect(stale).toContain('aria-label="Local conflicting draft"');
    expect(stale).toContain("revision 2");
    expect(stale).toContain("draft revision 4");
  });

  it("uses native keyboard controls, live regions, focusable confirmation, and explicit destructive confirmation", () => {
    const onAction = vi.fn();
    const onCancelConfirmation = vi.fn();
    const onRequestConfirmation = vi.fn();
    const props = {
      command: { actorId: "operator-1", idempotencyKey: "publish-1", reason: "Approved rollout" },
      onAction,
      onCancelConfirmation,
      onRequestConfirmation,
      state: reviewState(),
    };
    const tree = PlanReleaseConsole(props);
    const publishButton = findButton(tree, "Publish");
    expect(publishButton?.props.type).toBe("button");
    publishButton?.props.onClick();
    expect(onRequestConfirmation).toHaveBeenCalledWith(publishAction);
    expect(onAction).not.toHaveBeenCalled();

    const html = render(reviewState(), {
      ...props,
      pendingConfirmationActionId: publishAction.id,
    });
    expect(html).toContain('role="status"');
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("autofocus");
    expect(html).toContain("Confirm Publish");
    expect(html).toContain("operator-1");
    expect(html).toContain("Approved rollout");
    expect(html).toContain("publish-1");

    const confirmationTree = PlanReleaseConsole({
      ...props,
      pendingConfirmationActionId: publishAction.id,
    });
    const dialog = findElementByRole(confirmationTree, "alertdialog");
    const preventDefault = vi.fn();
    dialog?.props.onKeyDown({ key: "Escape", preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onCancelConfirmation).toHaveBeenCalledOnce();
  });

  it("requires confirmation for publish and schedule kinds even without destructive metadata", () => {
    const onAction = vi.fn();
    const onRequestConfirmation = vi.fn();
    const publishWithoutMetadata = { ...publishAction, destructive: undefined };
    const scheduleWithoutMetadata = { ...scheduleAction, destructive: undefined };
    const tree = PlanReleaseConsole({
      command: {
        actorId: "operator-1",
        idempotencyKey: "publish-1",
        reason: "Approved rollout",
        scheduledFor: candidate.effectiveAt,
      },
      onAction,
      onRequestConfirmation,
      state: reviewState({ actions: [publishWithoutMetadata, scheduleWithoutMetadata] }),
    });

    findButton(tree, "Publish")?.props.onClick();
    findButton(tree, "Schedule")?.props.onClick();

    expect(onRequestConfirmation).toHaveBeenNthCalledWith(1, publishWithoutMetadata);
    expect(onRequestConfirmation).toHaveBeenNthCalledWith(2, scheduleWithoutMetadata);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("executes failure recovery actions and confirms destructive recovery", () => {
    const onRecoveryAction = vi.fn();
    const onRequestConfirmation = vi.fn();
    const destructiveRecovery = {
      ...editAction,
      destructive: true,
      id: "discard-local-draft",
      label: "Discard local draft",
    };
    const state: PlanReleaseConsoleState = {
      kind: "problem",
      problem,
      recoveryActions: [editAction, destructiveRecovery],
    };
    const tree = PlanReleaseConsole({ onRecoveryAction, onRequestConfirmation, state });

    findButton(tree, "Return to draft")?.props.onClick();
    findButton(tree, "Discard local draft")?.props.onClick();

    expect(onRecoveryAction).toHaveBeenCalledWith(editAction);
    expect(onRequestConfirmation).toHaveBeenCalledWith(destructiveRecovery);

    const confirmationTree = PlanReleaseConsole({
      onRecoveryAction,
      onRequestConfirmation,
      pendingConfirmationActionId: destructiveRecovery.id,
      state,
    });
    expect(findElementByRole(confirmationTree, "alertdialog")).toBeDefined();
    findButton(confirmationTree, "Confirm Discard local draft")?.props.onClick();
    expect(onRecoveryAction).toHaveBeenCalledWith(destructiveRecovery);
  });

  it("renders semantic changes as domain labels instead of raw JSON", () => {
    const html = render(reviewState());
    expect(html).toContain("included seats: 1 → 3");
    expect(html).toContain("seat quota: 10 → 20");
    expect(html).toContain("usage tiers: none → meter key api.calls");
    expect(html).not.toContain("&quot;meterKey&quot;");
  });
});

type ButtonElement = ReactElement<{
  readonly children?: ReactNode;
  readonly onClick: () => void;
  readonly type: string;
}>;

function findButton(node: ReactNode, label: string): ButtonElement | undefined {
  if (!isValidElement(node)) return undefined;
  const element = node as ReactElement<{ readonly children?: ReactNode }>;
  if (element.type === "button" && textContent(element.props.children).includes(label)) {
    return element as ButtonElement;
  }
  for (const child of Children.toArray(element.props.children)) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return undefined;
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return Children.toArray(node).map(textContent).join("");
}

type RoleElement = ReactElement<{
  readonly children?: ReactNode;
  readonly onKeyDown: (event: { readonly key: string; preventDefault(): void }) => void;
  readonly role: string;
}>;

function findElementByRole(node: ReactNode, role: string): RoleElement | undefined {
  if (!isValidElement(node)) return undefined;
  const element = node as ReactElement<{ readonly children?: ReactNode; readonly role?: string }>;
  if (element.props.role === role) return element as RoleElement;
  for (const child of Children.toArray(element.props.children)) {
    const found = findElementByRole(child, role);
    if (found) return found;
  }
  return undefined;
}
