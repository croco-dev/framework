import {
  createElement,
  Fragment,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { ProblemNotice } from "./components";
import {
  getAllowedPlanReleaseActions,
  isPlanReleaseReviewCurrent,
  validatePlanReleaseActionRequest,
  type PlanReleaseActionRequest,
  type PlanReleaseAdminAction,
  type PlanReleaseConsoleSnapshot,
  type PlanReleaseConsoleState,
  type PlanReleaseDiagnostic,
  type PlanReleaseEditRequest,
  type PlanReleaseEditor,
  type PlanReleaseFieldDescriptor,
  type PlanReleaseImpactAudience,
  type PlanReleasePublishedReceipt,
  type PlanReleasePublishingState,
  type PlanReleaseReadyState,
  type PlanReleaseReviewState,
  type PlanReleaseSchedulingState,
} from "./planReleaseConsole";

export type PlanReleaseConsoleProps = {
  readonly state: PlanReleaseConsoleState;
  readonly command?: Omit<PlanReleaseActionRequest, "actionId" | "expectedReleaseRevision">;
  readonly pendingConfirmationActionId?: string;
  readonly onEdit?: (request: PlanReleaseEditRequest) => void;
  readonly onAction?: (action: PlanReleaseAdminAction, request: PlanReleaseActionRequest) => void;
  readonly onCancelConfirmation?: () => void;
  readonly onRequestConfirmation?: (action: PlanReleaseAdminAction) => void;
};

export function PlanReleaseConsole({
  command,
  onAction,
  onCancelConfirmation,
  onEdit,
  onRequestConfirmation,
  pendingConfirmationActionId,
  state,
}: PlanReleaseConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      {
        "aria-busy": true,
        "aria-label": "Plan release console",
        "data-state": state.kind,
      },
      createElement("p", { "aria-live": "polite" }, "Loading plan release"),
    );
  }

  if (!("editor" in state)) {
    if (state.kind === "stale-conflict") {
      return createElement(
        "section",
        { "aria-label": "Plan release console", "data-state": state.kind, role: "alert" },
        createElement("h1", { tabIndex: -1 }, stateTitle(state.kind)),
        createElement(ProblemNotice, { problem: state.problem }),
        createElement(
          "section",
          { "aria-label": "Local conflicting draft" },
          createElement("h2", null, "Local draft"),
          createElement(
            "p",
            null,
            `${state.localDraft.definition.ref}, revision ${state.localDraft.revision}`,
          ),
        ),
        createElement("h2", null, "Latest server state"),
        createSnapshot(state.latestServerSnapshot, "draft-editing"),
        createRecoveryActions(state.recoveryActions, onRequestConfirmation),
      );
    }

    return createElement(
      "section",
      {
        "aria-label": "Plan release console",
        "data-state": state.kind,
        role: "alert",
      },
      createElement("h1", { tabIndex: -1 }, stateTitle(state.kind)),
      createElement(ProblemNotice, { problem: state.problem }),
      state.snapshot ? createSnapshot(state.snapshot, "draft-editing") : null,
      createRecoveryActions(state.recoveryActions, onRequestConfirmation),
    );
  }

  const allowedActions = getAllowedPlanReleaseActions(state);
  const pendingAction = allowedActions.find(
    (action) => action.id === pendingConfirmationActionId && action.destructive,
  );

  return createElement(
    "section",
    {
      "aria-busy": state.kind === "validation" || state.kind === "publishing",
      "aria-label": "Plan release console",
      "data-draft-revision": state.snapshot.candidate.revision,
      "data-state": state.kind,
    },
    createElement(
      "div",
      { "aria-hidden": pendingAction ? true : undefined, inert: pendingAction ? true : undefined },
      createElement("h1", { tabIndex: -1 }, stateTitle(state.kind)),
      createElement("p", { "aria-live": "polite", role: "status" }, statusMessage(state.kind)),
      createSnapshot(state.snapshot, state.kind),
      state.kind === "draft-editing" ? createEditor(state.editor, state.snapshot, onEdit) : null,
      createDiagnostics(state.diagnostics),
      state.kind === "review" || state.kind === "scheduling" || state.kind === "publishing"
        ? createReview(state)
        : null,
      state.kind === "scheduling"
        ? createElement("p", null, `Scheduled for ${state.scheduledFor}`)
        : null,
      state.kind === "published" ? createPublishedReceipt(state.receipt) : null,
      createActions(allowedActions, state, command, onAction, onRequestConfirmation),
    ),
    pendingAction
      ? createConfirmation(pendingAction, state, command, onAction, onCancelConfirmation)
      : null,
  );
}

function createSnapshot(
  snapshot: PlanReleaseConsoleSnapshot,
  candidateStatus: PlanReleaseConsoleState["kind"],
): ReactElement {
  const versions = [
    ...(snapshot.currentPublished
      ? [{ definition: snapshot.currentPublished, status: "published" } as const]
      : []),
    { definition: snapshot.candidate.definition, status: candidateStatus },
  ];
  return createElement(
    "div",
    { "aria-label": "Published and candidate plan versions" },
    createElement("h2", null, `Plan family ${snapshot.candidate.definition.planId}`),
    createElement(
      "ul",
      { "aria-label": "Plan family versions" },
      versions.map(({ definition, status }) =>
        createElement(
          "li",
          { key: `${definition.ref}:${status}` },
          createElement("span", null, `${definition.name} (${definition.ref}) `),
          createElement(
            "span",
            { "aria-label": `Status: ${status}`, "data-status": status },
            status,
          ),
        ),
      ),
    ),
    createElement(
      "section",
      { "aria-label": "Current published plan" },
      createElement("h2", null, "Current published"),
      createElement(
        "p",
        null,
        snapshot.currentPublished
          ? `${snapshot.currentPublished.name} (${snapshot.currentPublished.ref})`
          : "No published version",
      ),
    ),
    createElement(
      "section",
      { "aria-label": "Candidate plan" },
      createElement("h2", null, "Candidate"),
      createElement(
        "p",
        null,
        `${snapshot.candidate.definition.name} (${snapshot.candidate.definition.ref}), draft revision ${snapshot.candidate.revision}`,
      ),
    ),
  );
}

function createEditor(
  editor: PlanReleaseEditor,
  snapshot: PlanReleaseConsoleSnapshot,
  onEdit?: PlanReleaseConsoleProps["onEdit"],
): ReactElement {
  return createElement(
    "form",
    {
      "aria-label": "Structured plan editor",
      onSubmit: (event: { preventDefault(): void }) => event.preventDefault(),
    },
    createElement("h2", null, "Edit candidate"),
    editor.fields.map((descriptor) =>
      createElement(
        "div",
        { key: descriptor.id },
        createElement("label", { htmlFor: `plan-release-${descriptor.id}` }, descriptor.label),
        descriptor.description
          ? createElement(
              "p",
              { id: `plan-release-${descriptor.id}-description` },
              descriptor.description,
            )
          : null,
        createField(descriptor, editor, snapshot, onEdit),
      ),
    ),
  );
}

function createField(
  descriptor: PlanReleaseFieldDescriptor,
  editor: PlanReleaseEditor,
  snapshot: PlanReleaseConsoleSnapshot,
  onEdit?: PlanReleaseConsoleProps["onEdit"],
): ReactElement {
  const common = {
    "aria-describedby": descriptor.description
      ? `plan-release-${descriptor.id}-description`
      : undefined,
    id: `plan-release-${descriptor.id}`,
    name: descriptor.id,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        descriptor.input === "number"
          ? Number(event.currentTarget.value)
          : event.currentTarget.value;
      onEdit?.({
        descriptorId: descriptor.id,
        expectedDraftRevision: snapshot.candidate.revision,
        value,
      });
    },
    value: descriptor.read(snapshot.candidate.definition),
  };

  if (descriptor.input === "select") {
    return createElement(
      "select",
      common,
      editor.catalog[descriptor.catalog].map((option) =>
        createElement("option", { key: option.key, value: option.key }, option.label),
      ),
    );
  }

  return createElement("input", {
    ...common,
    type: descriptor.input,
  });
}

function createDiagnostics(diagnostics: readonly PlanReleaseDiagnostic[]): ReactElement | null {
  if (diagnostics.length === 0) return null;
  return createElement(
    "section",
    { "aria-label": "Validation diagnostics" },
    createElement("h2", null, "Diagnostics"),
    createElement(
      "ul",
      null,
      diagnostics.map((diagnostic) =>
        createElement(
          "li",
          {
            "data-severity": diagnostic.severity,
            "data-source": diagnostic.source,
            key: `${diagnostic.source}:${diagnostic.code}:${diagnostic.location.path}`,
            role: diagnostic.severity === "error" ? "alert" : undefined,
          },
          createElement("strong", null, `${diagnostic.severity}: ${diagnostic.code}`),
          createElement("p", null, diagnostic.message),
          createElement("p", null, `Location: ${diagnostic.location.path}`),
          createElement("p", null, `Evidence: ${diagnostic.evidenceLevel}`),
          diagnostic.recovery.href && safeRecoveryHref(diagnostic.recovery.href)
            ? createElement("a", { href: diagnostic.recovery.href }, diagnostic.recovery.label)
            : diagnostic.recovery.actionId || diagnostic.location.fieldId
              ? createElement(
                  "button",
                  {
                    onClick: () => focusDiagnosticRecovery(diagnostic),
                    type: "button",
                  },
                  diagnostic.recovery.label,
                )
              : createElement("p", null, `Recovery: ${diagnostic.recovery.label}`),
        ),
      ),
    ),
  );
}

function createReview(
  state: PlanReleaseReviewState | PlanReleaseSchedulingState | PlanReleasePublishingState,
): ReactElement {
  const current = isPlanReleaseReviewCurrent(state);
  return createElement(
    Fragment,
    null,
    createElement(
      "section",
      { "aria-label": "Semantic plan diff", "data-review-current": current },
      createElement("h2", null, "Semantic diff"),
      !current
        ? createElement(
            "p",
            { role: "alert" },
            `Review revision ${state.reviewedDraftRevision} is stale for draft revision ${state.snapshot.candidate.revision}. Validate and review again.`,
          )
        : null,
      state.diff.map((group) =>
        createElement(
          "section",
          { "aria-label": `${group.group} changes`, key: group.group },
          createElement("h3", null, group.group),
          createElement(
            "ul",
            null,
            group.changes.map((change) =>
              createElement(
                "li",
                { key: change.field },
                `${change.field}: ${displayValue(change.before)} → ${displayValue(change.after)}`,
              ),
            ),
          ),
        ),
      ),
    ),
    createElement(
      "section",
      { "aria-label": "Release impact" },
      createElement("h2", null, "Impact"),
      createElement(
        "ul",
        null,
        state.impact.items.map((item) =>
          createElement(
            "li",
            { "data-impact-kind": item.kind, key: `${item.kind}:${item.code}` },
            createElement("strong", null, `${item.kind}: ${item.code}`),
            createElement("p", null, item.message),
            createElement("p", null, `Audience: ${audienceLabel(item.audience)}`),
            item.kind === "estimate"
              ? createElement("p", null, `Confidence: ${item.confidence ?? "unspecified"}`)
              : null,
          ),
        ),
      ),
    ),
  );
}

function createActions(
  actions: readonly PlanReleaseAdminAction[],
  state: PlanReleaseReadyState,
  command: PlanReleaseConsoleProps["command"],
  onAction: PlanReleaseConsoleProps["onAction"],
  onRequestConfirmation: PlanReleaseConsoleProps["onRequestConfirmation"],
): ReactElement {
  return createElement(
    "div",
    { "aria-label": "Plan release actions", role: "group" },
    actions.map((action) => {
      const request = createActionRequest(action, state.snapshot.releaseRevision, command);
      const validation = validatePlanReleaseActionRequest({ action, request, state });
      const disabledReason =
        validation.kind === "denied" ? `Required: ${validation.reasons.join(", ")}` : undefined;
      return createElement(
        "button",
        {
          "aria-describedby": action.description ? `plan-release-action-${action.id}` : undefined,
          "data-action": action.kind,
          "data-action-id": action.id,
          disabled: validation.kind === "denied",
          id: `plan-release-action-control-${action.id}`,
          key: action.id,
          onClick: () => {
            if (action.destructive) onRequestConfirmation?.(action);
            else onAction?.(action, request);
          },
          title: disabledReason,
          type: "button",
        },
        action.label,
        action.description
          ? createElement(
              "span",
              { hidden: true, id: `plan-release-action-${action.id}` },
              action.description,
            )
          : null,
      );
    }),
  );
}

function createConfirmation(
  action: PlanReleaseAdminAction,
  state: PlanReleaseReadyState,
  command: PlanReleaseConsoleProps["command"],
  onAction: PlanReleaseConsoleProps["onAction"],
  onCancel: PlanReleaseConsoleProps["onCancelConfirmation"],
): ReactElement {
  const titleId = `plan-release-confirm-${action.id}`;
  const request = createActionRequest(action, state.snapshot.releaseRevision, command);
  const validation = validatePlanReleaseActionRequest({ action, request, state });
  const cancel = () => {
    onCancel?.();
    if (typeof document !== "undefined") {
      queueMicrotask(() =>
        document.getElementById(`plan-release-action-control-${action.id}`)?.focus(),
      );
    }
  };
  return createElement(
    "div",
    {
      "aria-labelledby": titleId,
      "aria-modal": true,
      onKeyDown: trapConfirmationFocus(cancel),
      role: "alertdialog",
    },
    createElement("h2", { id: titleId }, `Confirm ${action.label}`),
    createElement("p", null, action.description ?? "This action changes the published plan."),
    createElement(
      "dl",
      null,
      receiptField("Actor", request.actorId ?? "Missing"),
      receiptField("Reason", request.reason ?? "Missing"),
      receiptField("Idempotency key", request.idempotencyKey ?? "Missing"),
      action.kind === "schedule"
        ? receiptField("Scheduled for", request.scheduledFor ?? "Missing")
        : null,
      receiptField("Release revision", String(request.expectedReleaseRevision)),
    ),
    createElement("button", { autoFocus: true, onClick: cancel, type: "button" }, "Cancel"),
    createElement(
      "button",
      {
        disabled: validation.kind === "denied",
        onClick: () => onAction?.(action, request),
        type: "button",
      },
      `Confirm ${action.label}`,
    ),
  );
}

function createPublishedReceipt(receipt: PlanReleasePublishedReceipt): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Published release receipt" },
    createElement("h2", null, "Publication receipt"),
    createElement(
      "dl",
      null,
      receiptField("Plan version", receipt.planVersionRef),
      receiptField("Reviewed draft revision", String(receipt.reviewedDraftRevision)),
      receiptField("Validation snapshot", receipt.validationSnapshotId),
      receiptField("Actor", receipt.actor.displayName ?? receipt.actor.id),
      receiptField("Reason", receipt.reason),
      receiptField("Idempotency key", receipt.idempotencyKey),
      receiptField("Published at", receipt.publishedAt),
    ),
  );
}

function receiptField(label: string, value: string): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement("dt", null, label),
    createElement("dd", null, value),
  );
}

function createRecoveryActions(
  actions: readonly PlanReleaseAdminAction[],
  onRequestConfirmation: PlanReleaseConsoleProps["onRequestConfirmation"],
): ReactElement | null {
  if (actions.length === 0) return null;
  return createElement(
    "div",
    { "aria-label": "Recovery actions", role: "group" },
    actions.map((action) =>
      createElement(
        "button",
        { key: action.id, onClick: () => onRequestConfirmation?.(action), type: "button" },
        action.label,
      ),
    ),
  );
}

function createActionRequest(
  action: PlanReleaseAdminAction,
  revision: number,
  command: PlanReleaseConsoleProps["command"],
): PlanReleaseActionRequest {
  return {
    ...command,
    actionId: action.id,
    expectedReleaseRevision: revision,
  };
}

function stateTitle(kind: PlanReleaseConsoleState["kind"]): string {
  const titles: Record<PlanReleaseConsoleState["kind"], string> = {
    "draft-editing": "Edit plan release draft",
    loading: "Plan release",
    "permission-denied": "Plan release permission denied",
    problem: "Plan release failed",
    published: "Plan release published",
    publishing: "Publishing plan release",
    review: "Review plan release",
    scheduling: "Schedule plan release",
    "provider-failure": "Plan provider failure",
    "stale-conflict": "Plan release conflict",
    validation: "Validate plan release",
  };
  return titles[kind];
}

function statusMessage(kind: PlanReleaseConsoleState["kind"]): string {
  if (kind === "published") return "The candidate is published.";
  if (kind === "publishing") return "Publication is in progress.";
  if (kind === "validation") return "Validation is in progress.";
  if (kind === "scheduling") return "The reviewed candidate is ready to schedule.";
  if (kind === "review") return "The candidate is ready for review.";
  return "The candidate draft is editable.";
}

function audienceLabel(audience: PlanReleaseImpactAudience): string {
  return typeof audience === "string" ? audience : `cohort:${audience.cohortId}`;
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null) return "not set";
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.map(displayValue).join("; ");
  if (typeof value === "object") {
    return Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${humanize(key)} ${displayValue(entry)}`)
      .join(", ");
  }
  return String(value);
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
}

function safeRecoveryHref(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("/") || href.startsWith("#");
}

function focusDiagnosticRecovery(diagnostic: PlanReleaseDiagnostic): void {
  if (typeof document === "undefined") return;
  const field = diagnostic.location.fieldId
    ? document.getElementById(`plan-release-${diagnostic.location.fieldId}`)
    : null;
  if (field) {
    field.focus();
    return;
  }
  if (diagnostic.recovery.actionId) {
    document.getElementById(`plan-release-action-control-${diagnostic.recovery.actionId}`)?.focus();
  }
}

function trapConfirmationFocus(
  onCancel: () => void,
): (event: KeyboardEvent<HTMLDivElement>) => void {
  return (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href]"),
    ].filter((element) => !element.hasAttribute("disabled"));
    const first = controls.at(0);
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
