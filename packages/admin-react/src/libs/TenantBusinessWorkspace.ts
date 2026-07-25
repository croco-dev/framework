import {
  createElement,
  Fragment,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";

import type {
  AdminAction,
  TenantWorkspaceAction,
  TenantWorkspaceExtension,
  TenantWorkspaceSectionId,
  TenantWorkspaceSnapshot,
  TenantWorkspaceSourceData,
  TenantWorkspaceSourceState,
} from "@croco/admin-core";
import type { ProblemDetails } from "@croco/problems-core";

export type TenantWorkspaceActionRequest = {
  readonly action: AdminAction;
  readonly requiredInput: {
    readonly reason: boolean;
    readonly idempotencyKey: boolean;
  };
  readonly possibleProblems: AdminAction["problems"];
};

export type TenantWorkspaceActionResult =
  | { readonly kind: "idle" }
  | {
      readonly kind: "confirming";
      readonly actionId: string;
      readonly requiredInput?: TenantWorkspaceActionRequest["requiredInput"];
    }
  | { readonly kind: "running"; readonly actionId: string }
  | { readonly kind: "succeeded"; readonly actionId: string; readonly message?: string }
  | {
      readonly kind: "problem";
      readonly actionId: string;
      readonly problem: ProblemDetails;
      readonly recoveryActionId?: string;
    };

export type TenantBusinessWorkspaceProps = {
  readonly state: TenantWorkspaceSnapshot;
  readonly activeSection?: TenantWorkspaceSectionId;
  readonly actionResult?: TenantWorkspaceActionResult;
  readonly onSectionChange?: (section: TenantWorkspaceSectionId) => void;
  readonly onRefreshSource?: (sourceId: string) => void;
  readonly onAction?: (request: TenantWorkspaceActionRequest) => void;
  readonly renderExtension?: (extension: TenantWorkspaceExtension) => ReactNode;
};

const STANDARD_SECTIONS: readonly {
  readonly id: TenantWorkspaceSectionId;
  readonly label: string;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "usage", label: "Usage" },
  { id: "billing", label: "Billing" },
  { id: "entitlements", label: "Entitlements" },
  { id: "members", label: "Members" },
  { id: "onboarding", label: "Onboarding" },
  { id: "operations", label: "Operations" },
];

export function TenantBusinessWorkspace({
  actionResult = { kind: "idle" },
  activeSection,
  onAction,
  onRefreshSource,
  onSectionChange,
  renderExtension,
  state,
}: TenantBusinessWorkspaceProps): ReactElement {
  const sections = collectSections(state);
  const [uncontrolledSection, setUncontrolledSection] =
    useState<TenantWorkspaceSectionId>("overview");
  const selectedSection = activeSection ?? uncontrolledSection;
  const selectSection = (section: TenantWorkspaceSectionId) => {
    if (activeSection === undefined) {
      setUncontrolledSection(section);
    }
    onSectionChange?.(section);
  };
  const identity = findSourceData(state.sources, "identity");

  return createElement(
    "article",
    {
      "aria-label": "Tenant 360 business workspace",
      "data-tenant-id": state.tenantId,
      "data-testid": "tenant-business-workspace",
    },
    createElement(
      "header",
      { "data-testid": "tenant-workspace-header" },
      createElement("p", null, "Tenant 360"),
      createElement("h1", null, identity?.kind === "identity" ? identity.name : state.tenantId),
      identity?.kind === "identity"
        ? createElement(
            "p",
            { "aria-label": "Tenant status" },
            `${identity.status}${identity.slug ? ` · ${identity.slug}` : ""}`,
          )
        : null,
      createHeaderBadges(state.sources),
    ),
    createElement(
      "nav",
      { "aria-label": "Tenant workspace sections" },
      createElement(
        "div",
        { role: "tablist" },
        sections.map((section, index) =>
          createElement(
            "button",
            {
              "aria-controls": `tenant-workspace-panel-${section.id}`,
              "aria-selected": selectedSection === section.id,
              "data-section": section.id,
              id: `tenant-workspace-tab-${section.id}`,
              key: section.id,
              onClick: () => selectSection(section.id),
              onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
                handleTenantWorkspaceTabKeyDown(event, sections, index, selectSection),
              role: "tab",
              tabIndex: selectedSection === section.id ? 0 : -1,
              type: "button",
            },
            section.label,
          ),
        ),
      ),
    ),
    sections.map((section) =>
      createElement(
        "section",
        {
          "aria-labelledby": `tenant-workspace-tab-${section.id}`,
          "data-section": section.id,
          hidden: selectedSection !== section.id,
          id: `tenant-workspace-panel-${section.id}`,
          key: section.id,
          role: "tabpanel",
          tabIndex: selectedSection === section.id ? 0 : -1,
        },
        selectedSection === section.id
          ? section.id === "overview"
            ? createOverview(
                state.sources,
                state.grantedPermissions,
                onRefreshSource,
                onAction,
                renderExtension,
              )
            : createSourceList(
                state.sources.filter((source) => source.section === section.id),
                state.grantedPermissions,
                onRefreshSource,
                onAction,
                renderExtension,
              )
          : null,
      ),
    ),
    createActionLauncher(state.actions, actionResult, onAction),
  );
}

export function createTenantWorkspaceActionRequest(
  action: AdminAction,
): TenantWorkspaceActionRequest {
  return {
    action,
    possibleProblems: action.problems,
    requiredInput: {
      idempotencyKey:
        action.idempotency === "required" || action.audit.idempotencyKey === "required",
      reason: action.audit.reason === "required",
    },
  };
}

function createHeaderBadges(sources: readonly TenantWorkspaceSourceState[]): ReactElement {
  const subscription = findSourceData(sources, "subscription");
  const health = findSourceData(sources, "health");
  const membership = findSourceData(sources, "membership");

  return createElement(
    "dl",
    { "aria-label": "Tenant summary badges" },
    subscription?.kind === "subscription"
      ? createBadge("Plan version", subscription.planVersionId ?? "Unavailable")
      : null,
    health?.kind === "health" ? createBadge("Health", `${health.state} (${health.score})`) : null,
    membership?.kind === "membership"
      ? createBadge(
          "Seats",
          membership.seatLimit === undefined
            ? `${membership.activeMembers} active`
            : `${membership.activeMembers} of ${membership.seatLimit}`,
        )
      : null,
  );
}

function createBadge(label: string, value: string): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement("dt", null, label),
    createElement("dd", null, value),
  );
}

function createOverview(
  sources: readonly TenantWorkspaceSourceState[],
  grantedPermissions: readonly string[],
  onRefreshSource: TenantBusinessWorkspaceProps["onRefreshSource"],
  onAction: TenantBusinessWorkspaceProps["onAction"],
  renderExtension: TenantBusinessWorkspaceProps["renderExtension"],
): ReactElement {
  return createElement(
    "div",
    { "aria-label": "Tenant summary cards", "data-testid": "tenant-summary-cards" },
    createSourceList(sources, grantedPermissions, onRefreshSource, onAction, renderExtension),
  );
}

function createSourceList(
  sources: readonly TenantWorkspaceSourceState[],
  grantedPermissions: readonly string[],
  onRefreshSource: TenantBusinessWorkspaceProps["onRefreshSource"],
  onAction: TenantBusinessWorkspaceProps["onAction"],
  renderExtension: TenantBusinessWorkspaceProps["renderExtension"],
): ReactElement {
  if (sources.length === 0) {
    return createElement(
      "p",
      { "data-state": "empty" },
      "No sources are configured for this section.",
    );
  }

  return createElement(
    Fragment,
    null,
    sources.map((source) =>
      createSourceCard(source, grantedPermissions, onRefreshSource, onAction, renderExtension),
    ),
  );
}

function createSourceCard(
  source: TenantWorkspaceSourceState,
  grantedPermissions: readonly string[],
  onRefreshSource: TenantBusinessWorkspaceProps["onRefreshSource"],
  onAction: TenantBusinessWorkspaceProps["onAction"],
  renderExtension: TenantBusinessWorkspaceProps["renderExtension"],
): ReactElement {
  const refreshButton = onRefreshSource
    ? createElement(
        "button",
        {
          "aria-label": `Refresh ${source.label}`,
          onClick: createTenantWorkspaceRefreshHandler(source.sourceId, onRefreshSource),
          type: "button",
        },
        "Refresh",
      )
    : null;

  if (source.kind === "loading") {
    return createElement(
      "section",
      {
        "aria-busy": true,
        "aria-label": source.label,
        "data-source-id": source.sourceId,
        "data-state": "loading",
        key: source.sourceId,
      },
      createElement("h2", null, source.label),
      createElement("p", null, "Loading source"),
    );
  }

  if (source.kind === "empty") {
    return createElement(
      "section",
      {
        "aria-label": source.label,
        "data-source-id": source.sourceId,
        "data-state": "empty",
        key: source.sourceId,
      },
      createElement("h2", null, source.label),
      createElement("p", null, source.message ?? "No data is available."),
      refreshButton,
    );
  }

  if (
    source.kind === "permission-denied" ||
    source.kind === "unavailable" ||
    source.kind === "problem"
  ) {
    return createElement(
      "section",
      {
        "aria-label": source.label,
        "data-source-id": source.sourceId,
        "data-state": source.kind,
        key: source.sourceId,
        role: "alert",
      },
      createElement("h2", null, source.label),
      createProblem(source.problem),
      source.kind === "permission-denied"
        ? createElement(
            "p",
            null,
            `Missing permissions: ${source.requiredPermissions
              .filter((permission) => !source.grantedPermissions.includes(permission))
              .join(", ")}`,
          )
        : null,
      source.kind === "problem" && source.recoveryActions
        ? createElement(
            "div",
            { "aria-label": `${source.label} recovery actions` },
            source.recoveryActions.map((action) => createActionButton(action, onAction)),
          )
        : null,
      refreshButton,
    );
  }

  return createElement(
    "section",
    {
      "aria-label": source.label,
      "data-source-id": source.sourceId,
      "data-state": source.kind,
      key: source.sourceId,
    },
    createElement("h2", null, source.label),
    source.kind === "stale"
      ? createElement(
          "p",
          { role: "status" },
          `Stale since ${source.staleAt.toISOString()}. Last successful data is preserved.`,
        )
      : null,
    createSourceData(source.state, grantedPermissions, renderExtension),
    source.kind === "stale" && source.problem ? createProblem(source.problem) : null,
    refreshButton,
  );
}

function createSourceData(
  state: TenantWorkspaceSourceData,
  grantedPermissions: readonly string[],
  renderExtension: TenantBusinessWorkspaceProps["renderExtension"],
): ReactNode {
  switch (state.kind) {
    case "identity":
      return createElement(
        Fragment,
        null,
        createElement("p", null, `${state.name} · ${state.status}`),
        state.fields?.map((field) =>
          createElement(
            "p",
            { "data-field-id": field.id, "data-visibility": field.visibility, key: field.id },
            `${field.label}: ${
              canRenderTenantField(field, grantedPermissions)
                ? formatValue(field.value)
                : field.visibility === "masked"
                  ? formatValue(field.maskedValue)
                  : "Permission required"
            }`,
          ),
        ),
      );
    case "subscription":
      return createElement(
        Fragment,
        null,
        createElement("p", null, `Status: ${state.status}`),
        createElement("p", null, `Plan: ${state.planName ?? "No plan"}`),
        createElement("p", null, `Immutable plan version: ${state.planVersionId ?? "Unavailable"}`),
        state.providerState === "read-only"
          ? createElement("p", null, "Provider state is read-only.")
          : null,
        createDetailLink(state.detailHref),
      );
    case "entitlements":
      return createSummaryWithLink(
        `Granted ${state.granted}; denied ${state.denied}; over quota ${state.overQuota}; warnings ${state.warnings}`,
        state.detailHref,
      );
    case "usage":
      return createElement(
        Fragment,
        null,
        createElement(
          "p",
          null,
          `${state.warningCount} forecast warning(s); ${state.overLimitCount} over limit`,
        ),
        state.meters.map((meter) =>
          createElement(
            "p",
            { key: meter.id },
            `${meter.label}: ${meter.usage}${meter.limit === undefined ? "" : ` / ${meter.limit}`} (${
              meter.classification
            })`,
          ),
        ),
        createDetailLink(state.detailHref),
      );
    case "membership":
      return createSummaryWithLink(
        state.seatLimit === undefined
          ? `${state.activeMembers} active members`
          : `${state.activeMembers} of ${state.seatLimit} seats used`,
        state.detailHref,
      );
    case "onboarding":
      return createSummaryWithLink(
        `${state.completedSteps} of ${state.totalSteps} steps · ${state.state}`,
        state.detailHref,
      );
    case "health":
      return createSummaryWithLink(
        `Score ${state.score} · ${state.state} · ${state.trend}`,
        state.detailHref,
      );
    case "failed-work":
      return createSummaryWithLink(
        `${state.openProblems} open Problems; ${state.failedOperations} failed operations; ${state.retryableOperations} retryable`,
        state.detailHref,
      );
    case "operations":
      return createElement(
        Fragment,
        null,
        state.entries.length === 0
          ? createElement("p", null, "No operations recorded.")
          : createElement(
              "ol",
              null,
              state.entries.map((entry) =>
                createElement(
                  "li",
                  { key: entry.id },
                  createElement("strong", null, entry.title),
                  createElement("p", null, entry.summary ?? entry.timestamp.toISOString()),
                  entry.problem?.code
                    ? createElement("p", null, `Problem: ${entry.problem.code}`)
                    : null,
                ),
              ),
            ),
        createDetailLink(state.detailHref),
      );
    case "extension":
      return renderExtension
        ? renderExtension(state)
        : createElement(
            "p",
            { "data-contract-id": state.contractId },
            `${state.label} extension is available to the host application.`,
          );
  }
}

function createActionLauncher(
  actions: readonly TenantWorkspaceAction[],
  result: TenantWorkspaceActionResult,
  onAction: TenantBusinessWorkspaceProps["onAction"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Tenant actions", "data-testid": "tenant-action-launcher" },
    createElement("h2", null, "Actions"),
    actions.length === 0
      ? createElement("p", null, "No explicit actions are available.")
      : actions.map((action) => createActionButton(action, onAction)),
    createActionResult(result, actions, onAction),
  );
}

function createActionButton(
  workspaceAction: TenantWorkspaceAction,
  onAction: TenantBusinessWorkspaceProps["onAction"],
): ReactElement {
  const { action, permission } = workspaceAction;
  const disabled =
    permission.kind === "denied" ||
    workspaceAction.availability.kind === "disabled" ||
    onAction === undefined;
  const permissionReason =
    permission.kind === "denied"
      ? [
          permission.missingPermissions.length > 0
            ? `Missing permissions: ${permission.missingPermissions.join(", ")}`
            : undefined,
          permission.unresolvedRequirements.length > 0
            ? "Contextual permission requirements need an explicit host decision."
            : undefined,
        ]
          .filter((part) => part !== undefined)
          .join(" ")
      : undefined;
  return createElement(
    "button",
    {
      "data-action-id": action.id,
      disabled,
      key: action.id,
      onClick: createTenantWorkspaceActionHandler(workspaceAction, onAction),
      title:
        permissionReason ??
        (workspaceAction.availability.kind === "disabled"
          ? workspaceAction.availability.reason
          : onAction === undefined
            ? "No action handler is configured."
            : undefined),
      type: "button",
    },
    action.label,
  );
}

export function createTenantWorkspaceRefreshHandler(
  sourceId: string,
  onRefreshSource: TenantBusinessWorkspaceProps["onRefreshSource"],
): () => void {
  return () => onRefreshSource?.(sourceId);
}

export function createTenantWorkspaceActionHandler(
  workspaceAction: TenantWorkspaceAction,
  onAction: TenantBusinessWorkspaceProps["onAction"],
): (() => void) | undefined {
  const { action, availability, permission } = workspaceAction;
  if (permission.kind === "denied" || availability.kind === "disabled" || onAction === undefined) {
    return undefined;
  }
  return () => onAction(createTenantWorkspaceActionRequest(action));
}

function createActionResult(
  result: TenantWorkspaceActionResult,
  actions: readonly TenantWorkspaceAction[],
  onAction: TenantBusinessWorkspaceProps["onAction"],
): ReactNode {
  switch (result.kind) {
    case "idle":
      return null;
    case "confirming": {
      const matchingAction = actions.find(({ action }) => action.id === result.actionId)?.action;
      const requiredInput =
        result.requiredInput ??
        (matchingAction
          ? createTenantWorkspaceActionRequest(matchingAction).requiredInput
          : undefined);
      const inputs = [
        requiredInput?.reason ? "audit reason" : undefined,
        requiredInput?.idempotencyKey ? "idempotency key" : undefined,
      ].filter((input) => input !== undefined);
      return createElement(
        "p",
        { role: "status" },
        inputs.length === 0
          ? `Confirm ${result.actionId}. No additional inputs are required.`
          : `Confirm ${result.actionId} with ${inputs.join(" and ")}.`,
      );
    }
    case "running":
      return createElement("p", { "aria-live": "polite" }, `Running ${result.actionId}`);
    case "succeeded":
      return createElement(
        "p",
        { role: "status" },
        result.message ?? `${result.actionId} completed`,
      );
    case "problem": {
      const recoveryAction = actions.find(({ action }) => action.id === result.recoveryActionId);
      return createElement(
        "div",
        { role: "alert" },
        createProblem(result.problem),
        recoveryAction
          ? createElement(
              "div",
              { "aria-label": "Action recovery" },
              createActionButton(recoveryAction, onAction),
            )
          : result.recoveryActionId
            ? createElement("p", null, `Recovery action unavailable: ${result.recoveryActionId}`)
            : null,
      );
    }
  }
}

function createProblem(problem: ProblemDetails): ReactElement {
  return createElement(
    "div",
    { "data-problem-type": problem.type },
    createElement("strong", null, problem.title),
    problem.detail ? createElement("p", null, problem.detail) : null,
  );
}

function createSummaryWithLink(summary: string, detailHref?: string): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement("p", null, summary),
    createDetailLink(detailHref),
  );
}

function createDetailLink(detailHref?: string): ReactNode {
  return detailHref ? createElement("a", { href: detailHref }, "View details") : null;
}

function findSourceData(
  sources: readonly TenantWorkspaceSourceState[],
  kind: TenantWorkspaceSourceData["kind"],
): TenantWorkspaceSourceData | undefined {
  for (const source of sources) {
    if ((source.kind === "ready" || source.kind === "stale") && source.state.kind === kind) {
      return source.state;
    }
  }
  return undefined;
}

function collectSections(
  state: TenantWorkspaceSnapshot,
): readonly { readonly id: TenantWorkspaceSectionId; readonly label: string }[] {
  const sections = [...STANDARD_SECTIONS];
  for (const source of state.sources) {
    if (!sections.some((section) => section.id === source.section)) {
      sections.push({ id: source.section, label: source.label });
    }
  }
  return sections;
}

export function handleTenantWorkspaceTabKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  sections: readonly { readonly id: TenantWorkspaceSectionId }[],
  index: number,
  onSectionChange: (section: TenantWorkspaceSectionId) => void,
): void {
  if (
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowRight" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }
  event.preventDefault();
  const nextSection = resolveTenantWorkspaceTabKey(event.key, sections, index);
  if (nextSection === undefined) {
    return;
  }
  const nextIndex = sections.findIndex((section) => section.id === nextSection);
  onSectionChange(nextSection);
  const tabs =
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs?.[nextIndex]?.focus();
}

export function resolveTenantWorkspaceTabKey(
  key: string,
  sections: readonly { readonly id: TenantWorkspaceSectionId }[],
  index: number,
): TenantWorkspaceSectionId | undefined {
  if (
    sections.length === 0 ||
    (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End")
  ) {
    return undefined;
  }
  const nextIndex =
    key === "Home"
      ? 0
      : key === "End"
        ? sections.length - 1
        : (index + (key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
  return sections[nextIndex]?.id;
}

function canRenderTenantField(
  field: NonNullable<Extract<TenantWorkspaceSourceData, { kind: "identity" }>["fields"]>[number],
  grantedPermissions: readonly string[],
): boolean {
  if (field.visibility !== "visible") {
    return false;
  }
  if (!field.sensitive) {
    return true;
  }
  return (
    field.requiredPermissions !== undefined &&
    field.requiredPermissions.length > 0 &&
    field.requiredPermissions.every((permission) => grantedPermissions.includes(permission))
  );
}

function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === undefined || value === null) {
    return "Unavailable";
  }
  return String(value);
}
