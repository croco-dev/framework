import { createElement, Fragment, type ChangeEvent, type ReactElement } from "react";

import type {
  OfferConsoleAction,
  OfferConsolePolicyView,
  OfferConsoleReadyState,
  OfferConsoleState,
  OfferPolicyEditorDraft,
} from "@croco/admin-core";

export type OfferConsoleProps = {
  readonly state: OfferConsoleState;
  readonly editor?: OfferPolicyEditorDraft;
  readonly editorErrors?: Readonly<Record<string, string>>;
  readonly selectedClaimId?: string;
  readonly onEditorChange?: (editor: OfferPolicyEditorDraft) => void;
  readonly onSubmitPolicy?: (editor: OfferPolicyEditorDraft) => void;
  readonly onSelectClaim?: (claimId: string) => void;
  readonly onAction?: (action: OfferConsoleAction) => void;
  readonly onRefresh?: () => void;
};

const EMPTY_EDITOR: OfferPolicyEditorDraft = {
  id: "",
  versionText: "1",
  familyId: "",
  benefitCycleId: "",
  benefitKind: "trial-credits",
  creditAmount: "",
  walletKey: "",
  percentBpsText: "",
  maxDiscountAmountText: "",
  currency: "USD",
  supportedProvidersText: "",
  startsAtText: "",
  endsAtText: "",
  perSubjectLimitText: "1",
  budgetTotal: "",
  budgetPerClaim: "",
  stackingGroup: "",
  allowStacking: false,
  eligibilityRevision: "",
  actorId: "",
  reason: "",
  idempotencyKey: "",
};

export function OfferConsole({
  editor,
  editorErrors,
  onAction,
  onEditorChange,
  onRefresh,
  onSelectClaim,
  onSubmitPolicy,
  selectedClaimId,
  state,
}: OfferConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      { "aria-busy": true, "aria-label": "Offer operations", "data-state": "loading" },
      createElement("h1", null, "Offers"),
      createElement("p", null, "Loading offer policies and claims."),
    );
  }
  if (state.kind === "empty") {
    return createElement(
      "section",
      { "aria-label": "Offer operations", "data-state": "empty" },
      createElement("h1", null, "Offers"),
      createElement("p", null, state.message ?? "No offer policies are registered yet."),
      createEditor(editor ?? EMPTY_EDITOR, editorErrors ?? {}, onEditorChange, onSubmitPolicy),
    );
  }
  if (state.kind === "permission-denied") {
    return createElement(
      "section",
      { "aria-label": "Offer operations", "data-state": "permission-denied", role: "alert" },
      createElement("h1", null, state.problem.title ?? "Offer permission denied"),
      createElement("p", null, state.problem.detail ?? state.problem.code),
      onRefresh ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry") : null,
    );
  }
  if (state.kind === "problem") {
    return createElement(
      Fragment,
      null,
      createElement(
        "section",
        {
          "aria-label": "Offer operations problem",
          "data-problem-code": state.problem.code,
          "data-state": "problem",
          role: "alert",
        },
        createElement("h1", null, state.problem.title ?? "Offer console unavailable"),
        createElement("p", null, state.problem.detail ?? state.problem.code),
        onRefresh
          ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry offers")
          : null,
      ),
      state.partial
        ? createReadyConsole({
            editor,
            editorErrors,
            onAction,
            onEditorChange,
            onRefresh,
            onSelectClaim,
            onSubmitPolicy,
            selectedClaimId,
            state: { ...state.partial, actions: [] },
          })
        : null,
    );
  }
  return createReadyConsole({
    editor,
    editorErrors,
    onAction,
    onEditorChange,
    onRefresh,
    onSelectClaim,
    onSubmitPolicy,
    selectedClaimId,
    state,
  });
}

function createReadyConsole({
  editor,
  editorErrors,
  onAction,
  onEditorChange,
  onRefresh,
  onSelectClaim,
  onSubmitPolicy,
  selectedClaimId,
  state,
}: Omit<OfferConsoleProps, "state"> & {
  readonly state: OfferConsoleReadyState;
}): ReactElement {
  const selected =
    state.snapshot.claims.find((claim) => claim.id === selectedClaimId) ?? state.snapshot.claims[0];
  return createElement(
    "section",
    {
      "aria-label": "Offer operations",
      "data-generated-at": state.snapshot.generatedAt.toISOString(),
      "data-state": "ready",
    },
    createElement("h1", null, "Offers"),
    onRefresh
      ? createElement("button", { onClick: onRefresh, type: "button" }, "Refresh offers")
      : null,
    createElement(
      "p",
      null,
      `${state.snapshot.policies.length} policies · ${state.snapshot.claims.length} claims · ${state.snapshot.pendingBudget} pending budget.`,
    ),
    createElement(
      "section",
      { "aria-label": "Offer policies" },
      createElement("h2", null, "Policies"),
      state.snapshot.policies.length === 0
        ? createElement("p", null, "No offer policies are registered yet.")
        : createElement(
            "ul",
            null,
            state.snapshot.policies.map((policy) =>
              createElement(
                "li",
                { "data-policy-id": policy.id, key: `${policy.id}@${policy.version}` },
                `${policy.id} v${policy.version} · ${policy.benefitKind} ${policy.face}${policy.currency ? ` ${policy.currency}` : ""} · ${policy.status} · budget ${policy.budgetReserved}/${policy.budgetTotal}`,
              ),
            ),
          ),
    ),
    createEditor(editor ?? EMPTY_EDITOR, editorErrors ?? {}, onEditorChange, onSubmitPolicy),
    createElement(
      "section",
      { "aria-label": "Offer claims" },
      createElement("h2", null, "Claims"),
      state.snapshot.claims.length === 0
        ? createElement("p", null, "No claims match the current scope.")
        : createElement(
            "ol",
            null,
            state.snapshot.claims.map((claim) =>
              createElement(
                "li",
                { "data-claim-state": claim.state, key: claim.id },
                createElement(
                  "button",
                  {
                    "aria-current": claim.id === selected?.id ? "true" : undefined,
                    onClick: () => onSelectClaim?.(claim.id),
                    type: "button",
                  },
                  `${claim.logicalKey} · ${claim.state}`,
                ),
                createElement(
                  "span",
                  null,
                  ` · ${claim.policyId} v${claim.policyVersion} · face ${claim.faceAmount} · cost ${claim.costAmount}`,
                ),
              ),
            ),
          ),
    ),
    selected ? createClaimDetail(selected) : null,
    createElement(
      "section",
      { "aria-label": "Audited offer actions" },
      createElement("h2", null, "Actions"),
      createElement(
        "ul",
        null,
        state.actions.map((action) =>
          createElement(
            "li",
            { key: `${action.kind}:${action.targetId}` },
            createElement(
              "button",
              {
                "data-action": action.kind,
                "data-target-id": action.targetId,
                disabled: !action.allowed || onAction === undefined,
                onClick: () => onAction?.(action),
                title: action.reason,
                type: "button",
              },
              actionLabel(action.kind),
            ),
          ),
        ),
      ),
    ),
  );
}

function createClaimDetail(
  claim: OfferConsoleReadyState["snapshot"]["claims"][number],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": `Claim ${claim.id} details` },
    createElement("h3", null, `Claim ${claim.logicalKey}`),
    createElement(
      "p",
      null,
      `${claim.state} · customer ${claim.subject.maskedId} · tenant ${claim.subject.tenantId}`,
    ),
    claim.grantRef ? createElement("p", null, `Grant reference: ${claim.grantRef}`) : null,
    claim.state === "indeterminate"
      ? createElement(
          "p",
          { role: "status" },
          "The grant outcome is unclear. The budget stays locked until reconciliation or an operator decision.",
        )
      : null,
  );
}

function actionLabel(kind: OfferConsoleAction["kind"]): string {
  switch (kind) {
    case "register-policy":
      return "Register policy";
    case "expire-claims":
      return "Expire lapsed claims";
    case "resolve-claim":
      return "Resolve claim";
  }
}

function createEditor(
  editor: OfferPolicyEditorDraft,
  errors: Readonly<Record<string, string>>,
  onEditorChange: OfferConsoleProps["onEditorChange"],
  onSubmitPolicy: OfferConsoleProps["onSubmitPolicy"],
): ReactElement {
  const set = (patch: Partial<OfferPolicyEditorDraft>): void =>
    onEditorChange?.({ ...editor, ...patch });
  return createElement(
    "section",
    { "aria-label": "Offer policy editor" },
    createElement("h2", null, "Policy editor"),
    createElement(
      "p",
      null,
      "Size, period, caps, exclusions, and cost caps are edited here. Limits are mandatory.",
    ),
    createTextField("Policy id", editor.id, errors.id, (value) => set({ id: value })),
    createTextField("Version", editor.versionText, errors.versionText, (value) =>
      set({ versionText: value }),
    ),
    createTextField("Benefit cycle id", editor.benefitCycleId, errors.benefitCycleId, (value) =>
      set({ benefitCycleId: value }),
    ),
    createElement(
      "label",
      null,
      "Benefit kind",
      createElement(
        "select",
        {
          onChange: (event: ChangeEvent<HTMLSelectElement>) =>
            set({
              benefitKind:
                event.currentTarget.value === "discount-quote" ? "discount-quote" : "trial-credits",
            }),
          value: editor.benefitKind,
        },
        createElement("option", { value: "trial-credits" }, "trial-credits"),
        createElement("option", { value: "discount-quote" }, "discount-quote"),
      ),
    ),
    editor.benefitKind === "trial-credits"
      ? createTextField("Credit amount", editor.creditAmount, errors.creditAmount, (value) =>
          set({ creditAmount: value }),
        )
      : createElement(
          Fragment,
          null,
          createTextField(
            "Percent basis points",
            editor.percentBpsText,
            errors.percentBpsText,
            (value) => set({ percentBpsText: value }),
          ),
          createTextField(
            "Maximum discount minor units",
            editor.maxDiscountAmountText,
            errors.maxDiscountAmountText,
            (value) => set({ maxDiscountAmountText: value }),
          ),
        ),
    createTextField("Currency", editor.currency, errors.currency, (value) =>
      set({ currency: value }),
    ),
    createTextField(
      "Supported providers (comma separated)",
      editor.supportedProvidersText,
      errors.supportedProvidersText,
      (value) => set({ supportedProvidersText: value }),
    ),
    createTextField("Starts at", editor.startsAtText, errors.startsAtText, (value) =>
      set({ startsAtText: value }),
    ),
    createTextField("Ends at", editor.endsAtText, errors.endsAtText, (value) =>
      set({ endsAtText: value }),
    ),
    createTextField(
      "Per-subject limit",
      editor.perSubjectLimitText,
      errors.perSubjectLimitText,
      (value) => set({ perSubjectLimitText: value }),
    ),
    createTextField("Budget total", editor.budgetTotal, errors.budgetTotal, (value) =>
      set({ budgetTotal: value }),
    ),
    createTextField("Budget per claim", editor.budgetPerClaim, errors.budgetPerClaim, (value) =>
      set({ budgetPerClaim: value }),
    ),
    createTextField(
      "Stacking group (exclusion)",
      editor.stackingGroup,
      errors.stackingGroup,
      (value) => set({ stackingGroup: value }),
    ),
    createTextField("Actor", editor.actorId, errors.actorId, (value) => set({ actorId: value })),
    createTextField("Reason", editor.reason, errors.reason, (value) => set({ reason: value })),
    createTextField("Idempotency key", editor.idempotencyKey, errors.idempotencyKey, (value) =>
      set({ idempotencyKey: value }),
    ),
    errors.general ? createElement("p", { role: "alert" }, errors.general) : null,
    onSubmitPolicy
      ? createElement(
          "button",
          { onClick: () => onSubmitPolicy(editor), type: "button" },
          "Validate policy",
        )
      : null,
  );
}

function createTextField(
  label: string,
  value: string,
  error: string | undefined,
  onChange: (value: string) => void,
): ReactElement {
  return createElement(
    "label",
    null,
    label,
    createElement("input", {
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
      type: "text",
      value,
    }),
    error ? createElement("span", { role: "alert" }, error) : null,
  );
}

export type { OfferConsolePolicyView };
