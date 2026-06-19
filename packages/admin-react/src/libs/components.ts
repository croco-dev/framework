import { createElement, Fragment, type ReactElement } from "react";

import type { ProblemDetails } from "@croco/problems-core";

import type {
  AdminActionContract,
  AdminBillingStatus,
  AdminEntitlementRow,
  AdminPanelActionHandler,
  AdminPlanSummary,
  AdminProviderState,
  AdminUsageMeter,
  BillingEntitlementAdminPanelProps,
  BillingEntitlementAdminPanelState,
} from "./types";

export function BillingEntitlementAdminPanel({
  onAction,
  state,
}: BillingEntitlementAdminPanelProps): ReactElement {
  if (state.kind === "provider_failure") {
    return createElement(
      "section",
      {
        "aria-label": "Billing and entitlement admin panel",
        "data-testid": "admin-provider-failure",
        role: "alert",
      },
      createElement(ProblemNotice, { problem: state.problem }),
      state.partial?.billing
        ? createElement(BillingStatus, { billing: state.partial.billing })
        : null,
      createElement(ProviderStatus, { provider: state.provider }),
    );
  }

  if (state.kind === "permission_denied") {
    return createElement(
      "section",
      {
        "aria-label": "Billing and entitlement admin panel",
        "data-testid": "admin-permission-denied",
        role: "alert",
      },
      createElement(ProblemNotice, { problem: state.problem }),
      createElement(
        "p",
        { "data-testid": "missing-permissions" },
        `Missing permissions: ${state.requiredPermissions.join(", ")}`,
      ),
      createElement(AdminActionList, {
        actions: state.actions,
        forcedDisabledReason: "Panel permissions denied",
        grantedPermissions: state.grantedPermissions,
        onAction,
      }),
    );
  }

  return createElement(
    "section",
    {
      "aria-label": "Billing and entitlement admin panel",
      "data-testid": "admin-panel-ready",
    },
    createElement(PlanSummary, { plan: state.plan }),
    createElement(BillingStatus, { billing: state.billing }),
    createElement(ProviderStatus, { provider: state.provider }),
    createElement(EntitlementList, { entitlements: state.entitlements }),
    createElement(
      "section",
      { "aria-label": "Usage and quota", "data-testid": "usage-quota-list" },
      state.usage.map((meter) => createElement(UsageQuotaMeter, { key: meter.meterId, meter })),
    ),
    createElement(AdminActionList, {
      actions: state.actions,
      grantedPermissions: state.grantedPermissions,
      onAction,
    }),
  );
}

export function PlanSummary({ plan }: { readonly plan: AdminPlanSummary }): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Plan summary",
      "data-mutability": plan.mutability,
      "data-source": plan.source,
      "data-testid": "plan-summary",
    },
    createElement("h2", null, plan.name),
    createElement("p", null, `Plan ID: ${plan.planId}`),
    createElement("p", null, `Subscription: ${formatStatus(plan.subscriptionStatus)}`),
    plan.amountMinor !== undefined && plan.currency
      ? createElement("p", null, `Price: ${plan.amountMinor} ${plan.currency}`)
      : null,
  );
}

export function BillingStatus({ billing }: { readonly billing: AdminBillingStatus }): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Billing status",
      "data-mutability": billing.mutability,
      "data-source": billing.source,
      "data-testid": "billing-status",
    },
    createElement("h2", null, "Billing"),
    createElement("p", null, `Status: ${formatStatus(billing.status)}`),
    billing.subscriptionId
      ? createElement("p", null, `Subscription: ${billing.subscriptionId}`)
      : null,
    billing.currentPeriodEnd
      ? createElement("p", null, `Current period ends: ${formatDate(billing.currentPeriodEnd)}`)
      : null,
    billing.cancelAtPeriodEnd ? createElement("p", null, "Cancels at period end") : null,
  );
}

export function EntitlementList({
  entitlements,
}: {
  readonly entitlements: readonly AdminEntitlementRow[];
}): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Entitlements", "data-testid": "entitlement-list" },
    createElement("h2", null, "Entitlements"),
    entitlements.length === 0
      ? createElement("p", { "data-state": "empty" }, "No entitlements declared")
      : entitlements.map((entitlement) =>
          createElement(
            "article",
            {
              "data-feature-key": entitlement.featureKey,
              "data-state": entitlement.state,
              key: entitlement.featureKey,
            },
            createElement("h3", null, entitlement.label ?? entitlement.featureKey),
            createElement("p", null, formatEntitlementState(entitlement.state)),
            entitlement.quota !== undefined
              ? createElement("p", null, `Quota: ${entitlement.usage ?? 0}/${entitlement.quota}`)
              : null,
            entitlement.problem
              ? createElement(
                  "p",
                  { "data-problem-code": entitlement.problem.code },
                  entitlement.problem.code,
                )
              : null,
          ),
        ),
  );
}

export function UsageQuotaMeter({ meter }: { readonly meter: AdminUsageMeter }): ReactElement {
  const quotaText = meter.quota === undefined ? "unlimited" : `${meter.usage}/${meter.quota}`;

  return createElement(
    "article",
    {
      "aria-label": meter.label ?? meter.meterId,
      "data-meter-id": meter.meterId,
      "data-mutability": meter.mutability,
      "data-source": meter.source,
      "data-state": meter.state,
    },
    createElement("h3", null, meter.label ?? meter.meterId),
    createElement("p", null, `Usage: ${quotaText}`),
    meter.percent !== undefined ? createElement("p", null, `${meter.percent}%`) : null,
    meter.state === "over-quota" ? createElement("strong", null, "Over quota") : null,
  );
}

export function AdminActionList({
  actions,
  forcedDisabledReason,
  grantedPermissions,
  onAction,
}: {
  readonly actions: readonly AdminActionContract[];
  readonly forcedDisabledReason?: string;
  readonly grantedPermissions: readonly string[];
  readonly onAction?: AdminPanelActionHandler;
}): ReactElement {
  const granted = new Set(grantedPermissions);

  return createElement(
    "section",
    { "aria-label": "Admin actions", "data-testid": "admin-actions" },
    createElement("h2", null, "Actions"),
    actions.map((action) => {
      const missingPermissions = action.permissions.filter(
        (permission) => !granted.has(permission),
      );
      const disabledReason =
        forcedDisabledReason ??
        action.disabledReason ??
        (missingPermissions.length > 0
          ? `Missing permissions: ${missingPermissions.join(", ")}`
          : undefined);

      return createElement(
        "button",
        {
          "data-action-id": action.id,
          "data-audit-event": action.audit.eventName,
          "data-mutability": action.mutability,
          "data-problem-codes": action.possibleProblems.map((problem) => problem.code).join(","),
          "data-source": action.source,
          disabled: disabledReason !== undefined,
          key: action.id,
          onClick: () => onAction?.(action),
          title: disabledReason,
          type: "button",
        },
        action.label,
      );
    }),
  );
}

export function ProblemNotice({ problem }: { readonly problem: ProblemDetails }): ReactElement {
  return createElement(
    "div",
    {
      "data-problem-code": problem.code,
      "data-problem-status": problem.status,
      "data-testid": "admin-problem",
    },
    createElement("strong", null, problem.title),
    createElement("p", null, problem.detail ?? problem.code),
  );
}

function ProviderStatus({ provider }: { readonly provider: AdminProviderState }): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Billing provider status",
      "data-mutability": provider.mutability,
      "data-source": provider.source,
      "data-state": provider.status,
      "data-testid": "billing-provider-status",
    },
    createElement("h2", null, `Provider: ${provider.providerName}`),
    createElement("p", null, `Status: ${formatStatus(provider.status)}`),
    provider.externalSubscriptionId
      ? createElement("p", null, `Provider subscription: ${provider.externalSubscriptionId}`)
      : null,
    provider.problem
      ? createElement(Fragment, null, createElement(ProblemNotice, { problem: provider.problem }))
      : null,
  );
}

function formatStatus(status: string): string {
  return status
    .split(/[-_]/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatEntitlementState(state: AdminEntitlementRow["state"]): string {
  if (state === "over-quota") {
    return "Over quota";
  }

  if (state === "allowed-overage") {
    return "Allowed overage";
  }

  return formatStatus(state);
}

function formatDate(value: Date): string {
  return value.toISOString();
}

export type { BillingEntitlementAdminPanelState };
