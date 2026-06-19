import type { EntitlementCheckResult } from "@croco/entitlements-core";
import type { ProblemDetails } from "@croco/problems-core";

import type {
  AdminActionContract,
  AdminActionPermissionDecision,
  AdminBillingStatus,
  AdminEntitlementRow,
  AdminMeteringState,
  AdminPlanSummary,
  AdminProviderState,
  AdminUsageMeter,
  AdminUsageMeterInput,
  BillingEntitlementAdminPanelState,
  BillingEntitlementAdminPanelStateInput,
} from "./types";

const ABOUT_BLANK = "about:blank";

export function createCoreProblemDetails(options: {
  readonly code: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly source?: string;
}): ProblemDetails {
  return {
    type: ABOUT_BLANK,
    title: options.title,
    status: options.status,
    code: options.code,
    ...(options.detail ? { detail: options.detail } : {}),
    ...(options.source ? { source: options.source } : {}),
  };
}

export function createPermissionDeniedProblemDetails(
  tenantId: string,
  missingPermissions: readonly string[],
): ProblemDetails {
  return createCoreProblemDetails({
    code: "admin/permission-denied",
    detail: `Tenant '${tenantId}' requires permissions: ${missingPermissions.join(", ")}`,
    source: "permissions",
    status: 403,
    title: "Forbidden",
  });
}

export function evaluateAdminActionPermissions(
  action: AdminActionContract,
  grantedPermissions: readonly string[],
): AdminActionPermissionDecision {
  const granted = new Set(grantedPermissions);
  const missingPermissions = action.permissions.filter((permission) => !granted.has(permission));

  if (missingPermissions.length === 0) {
    return {
      action,
      kind: "allowed",
    };
  }

  return {
    action,
    kind: "denied",
    missingPermissions,
    problem: createPermissionDeniedProblemDetails(action.audit.subjectId, missingPermissions),
  };
}

export function createBillingEntitlementAdminPanelState(
  input: BillingEntitlementAdminPanelStateInput,
): BillingEntitlementAdminPanelState {
  const generatedAt = input.generatedAt ?? new Date();
  const requiredPermissions = input.requiredPermissions ?? [];
  const grantedPermissions = input.grantedPermissions ?? [];
  const missingPermissions = requiredPermissions.filter(
    (permission) => !grantedPermissions.includes(permission),
  );
  const actions = input.actions ?? [];

  if (missingPermissions.length > 0) {
    return {
      actions,
      generatedAt,
      grantedPermissions,
      kind: "permission_denied",
      problem: createPermissionDeniedProblemDetails(input.tenantId, missingPermissions),
      requiredPermissions,
      tenantId: input.tenantId,
    };
  }

  const provider = createProviderState(input);
  const providerFailure = input.providerFailure ?? createProviderFailureProblem(provider);

  if (providerFailure) {
    return {
      generatedAt,
      kind: "provider_failure",
      partial: {
        actions,
        billing: createBillingStatus(input),
        entitlements: createEntitlementRows(input.entitlementChecks ?? []),
        metering: createMeteringState(input),
        plan: createPlanSummary(input),
        usage: createUsageMeters(input.usageMeters ?? []),
      },
      problem: providerFailure,
      provider: {
        ...provider,
        problem: providerFailure,
        status: "unavailable",
      },
      tenantId: input.tenantId,
    };
  }

  return {
    actions,
    billing: createBillingStatus(input),
    entitlements: createEntitlementRows(input.entitlementChecks ?? []),
    generatedAt,
    grantedPermissions,
    kind: "ready",
    metering: createMeteringState(input),
    plan: createPlanSummary(input),
    provider,
    tenantId: input.tenantId,
    usage: createUsageMeters(input.usageMeters ?? []),
  };
}

export const createInMemoryBillingEntitlementAdminPanelState =
  createBillingEntitlementAdminPanelState;

function createPlanSummary(input: BillingEntitlementAdminPanelStateInput): AdminPlanSummary {
  const subscriptionStatus = input.subscription?.status ?? "missing";
  const planId = input.plan?.id ?? input.subscription?.planId ?? "missing";

  return {
    interval: input.plan?.interval,
    intervalCount: input.plan?.intervalCount,
    ...(input.plan ? { amountMinor: input.plan.amount, currency: input.plan.currency } : {}),
    mutability: "editable",
    name: input.plan?.name ?? "No plan",
    planId,
    source: "croco",
    subscriptionStatus,
  };
}

function createBillingStatus(input: BillingEntitlementAdminPanelStateInput): AdminBillingStatus {
  return {
    accountId: input.account?.id,
    cancelAtPeriodEnd: input.subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: input.subscription?.currentPeriodEnd,
    externalCustomerId: input.account?.externalCustomerId,
    externalSubscriptionId: input.subscription?.externalSubscriptionId,
    lastSyncedAt: input.subscription?.lastSyncedAt,
    mutability: "editable",
    source: "croco",
    status: input.subscription?.status ?? "missing",
    subscriptionId: input.subscription?.id,
  };
}

function createProviderState(input: BillingEntitlementAdminPanelStateInput): AdminProviderState {
  return {
    externalCustomerId: input.provider?.externalCustomerId ?? input.account?.externalCustomerId,
    externalSubscriptionId:
      input.provider?.externalSubscriptionId ?? input.subscription?.externalSubscriptionId,
    lastSyncedAt: input.provider?.lastSyncedAt ?? input.subscription?.lastSyncedAt,
    mutability: "read-only",
    problem: input.provider?.problem,
    providerName: input.provider?.providerName ?? "unknown",
    source: "provider",
    status: input.provider?.status ?? "synced",
  };
}

function createProviderFailureProblem(provider: AdminProviderState): ProblemDetails | undefined {
  if (provider.problem) {
    return provider.problem;
  }

  if (provider.status !== "unavailable") {
    return undefined;
  }

  return createCoreProblemDetails({
    code: "billing-provider/unavailable",
    detail: `Billing provider '${provider.providerName}' is unavailable`,
    source: "provider",
    status: 503,
    title: "Service Unavailable",
  });
}

function createMeteringState(input: BillingEntitlementAdminPanelStateInput): AdminMeteringState {
  return {
    lastUpdatedAt: input.metering?.lastUpdatedAt,
    mutability: "read-only",
    problem: input.metering?.problem,
    source: "croco",
    status: input.metering?.status ?? "current",
  };
}

function createEntitlementRows(checks: readonly EntitlementCheckResult[]): AdminEntitlementRow[] {
  return checks.map((check) => {
    const state = getEntitlementState(check);
    const problem = createEntitlementProblem(check, state);

    return {
      exceeded: check.exceeded,
      featureKey: check.featureKey,
      granted: check.granted,
      mutability: "editable",
      overagePolicy: check.overagePolicy,
      problem,
      quota: check.quota,
      reason: check.reason,
      remaining: check.remaining,
      source: "croco",
      state,
      type: check.type,
      usage: check.usage,
      value: check.value,
    };
  });
}

function getEntitlementState(check: EntitlementCheckResult): AdminEntitlementRow["state"] {
  if (check.granted && !check.exceeded) {
    return "active";
  }

  if (check.exceeded && check.overagePolicy === "WARN") {
    return "warn";
  }

  if (check.exceeded && check.overagePolicy === "ALLOW_WITH_OVERAGE") {
    return "allowed-overage";
  }

  if (check.exceeded) {
    return "over-quota";
  }

  if (isMissingEntitlementReason(check.reason)) {
    return "missing";
  }

  return "denied";
}

function createEntitlementProblem(
  check: EntitlementCheckResult,
  state: AdminEntitlementRow["state"],
): ProblemDetails | undefined {
  if (state === "active" || state === "warn" || state === "allowed-overage") {
    return undefined;
  }

  if (state === "missing") {
    return createCoreProblemDetails({
      code: "ENTITLEMENT_NOT_FOUND",
      detail: `Entitlement '${check.featureKey}' is not available for the tenant plan`,
      source: "entitlements",
      status: 404,
      title: "Not Found",
    });
  }

  if (state === "over-quota") {
    return createCoreProblemDetails({
      code: "metering/quota-exceeded",
      detail: `Entitlement '${check.featureKey}' exceeded quota ${check.quota ?? "unknown"}`,
      source: "metering",
      status: 429,
      title: "Too Many Requests",
    });
  }

  return createCoreProblemDetails({
    code: "ENTITLEMENT_DENIED",
    detail: check.reason ?? `Entitlement '${check.featureKey}' denied`,
    source: "entitlements",
    status: 403,
    title: "Forbidden",
  });
}

function isMissingEntitlementReason(reason: string | undefined): boolean {
  if (!reason) {
    return false;
  }

  const normalized = reason.toLowerCase();
  return (
    normalized.includes("missing") ||
    normalized.includes("not_found") ||
    normalized.includes("not found")
  );
}

function createUsageMeters(inputs: readonly AdminUsageMeterInput[]): AdminUsageMeter[] {
  return inputs.map((input) => {
    const quota = input.quota ?? undefined;
    const remaining = quota === undefined ? undefined : quota - input.usage;
    const percent =
      quota === undefined || quota <= 0 ? undefined : Math.round((input.usage / quota) * 100);
    const state =
      quota === undefined ? "unlimited" : input.usage > quota ? "over-quota" : "within-quota";

    return {
      label: input.label,
      meterId: input.meterId,
      mutability: "read-only",
      percent,
      period: input.period,
      quota,
      remaining,
      source: "croco",
      state,
      usage: input.usage,
    };
  });
}
