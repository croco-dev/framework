import type { BillingAccount, Plan, Subscription } from "@croco/billing-core";
import type { EntitlementCheckResult } from "@croco/entitlements-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BillingEntitlementAdminPanel } from "../libs/components";
import {
  createBillingEntitlementAdminPanelState,
  createCoreProblemDetails,
} from "../libs/snapshot";
import type { AdminActionContract } from "../libs/types";

const generatedAt = new Date("2026-06-19T00:00:00.000Z");
const periodEnd = new Date("2026-07-19T00:00:00.000Z");

const account: BillingAccount = {
  createdAt: generatedAt,
  email: "ops@example.com",
  externalCustomerId: "cus_123",
  id: "acct_123",
  tenantId: "tenant-1",
};

const subscription: Subscription = {
  billingAccountId: account.id,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: periodEnd,
  externalSubscriptionId: "sub_123",
  id: "sub-local-123",
  lastSyncedAt: generatedAt,
  planId: "pro",
  planVersionRef: "pro@v1" as Subscription["planVersionRef"],
  status: "active",
};

const plan: Plan = {
  amount: 4900,
  currency: "USD",
  id: "pro",
  interval: "month",
  intervalCount: 1,
  name: "Pro",
};

const adjustPlanAction: AdminActionContract = {
  audit: {
    eventName: "billing.admin.plan_adjusted",
    subjectId: "tenant-1",
    subjectType: "tenant",
  },
  id: "adjust-plan",
  label: "Adjust plan",
  mutability: "editable",
  permissions: ["billing:write"],
  possibleProblems: [
    {
      code: "billing/subscription-not-found",
      source: "billing",
    },
  ],
  source: "croco",
};

function renderState(state: ReturnType<typeof createBillingEntitlementAdminPanelState>): string {
  return renderToStaticMarkup(createElement(BillingEntitlementAdminPanel, { state }));
}

describe("BillingEntitlementAdminPanel", () => {
  it("represents active plan, entitlement, usage, provider, and safe actions for a tenant", () => {
    const state = createBillingEntitlementAdminPanelState({
      account,
      actions: [adjustPlanAction],
      entitlementChecks: [
        {
          featureKey: "reports",
          granted: true,
          status: "allowed",
          planId: "pro",
          quota: 100,
          remaining: 80,
          type: "metered",
          usage: 20,
        },
      ],
      generatedAt,
      grantedPermissions: ["billing:read", "billing:write"],
      plan,
      provider: {
        providerName: "polar",
      },
      requiredPermissions: ["billing:read"],
      subscription,
      tenantId: "tenant-1",
      usageMeters: [{ meterId: "reports", quota: 100, usage: 20 }],
    });

    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") {
      return;
    }

    expect(state.plan.name).toBe("Pro");
    expect(state.provider.mutability).toBe("read-only");
    expect(state.actions[0]?.audit.eventName).toBe("billing.admin.plan_adjusted");
    expect(state.actions[0]?.possibleProblems[0]?.code).toBe("billing/subscription-not-found");

    const markup = renderState(state);

    expect(markup).toContain('data-testid="admin-panel-ready"');
    expect(markup).toContain("Pro");
    expect(markup).toContain("Status: Active");
    expect(markup).toContain('data-audit-event="billing.admin.plan_adjusted"');
    expect(markup).toContain('data-problem-codes="billing/subscription-not-found"');
  });

  it("renders over-quota state without treating it as active success", () => {
    const state = createBillingEntitlementAdminPanelState({
      account,
      entitlementChecks: [
        {
          exceeded: true,
          featureKey: "api_calls",
          granted: false,
          status: "denied",
          overagePolicy: "BLOCK",
          quota: 100,
          reason: "quota_exceeded",
          remaining: -20,
          type: "metered",
          usage: 120,
        },
      ],
      generatedAt,
      grantedPermissions: ["billing:read"],
      plan,
      requiredPermissions: ["billing:read"],
      subscription,
      tenantId: "tenant-1",
      usageMeters: [{ meterId: "api_calls", quota: 100, usage: 120 }],
    });

    const markup = renderState(state);

    expect(markup).toContain('data-state="over-quota"');
    expect(markup).toContain("Over quota");
    expect(markup).toContain('data-problem-code="metering/quota-exceeded"');
  });

  it("renders missing entitlement state with an explicit Problem code", () => {
    const missingEntitlement: EntitlementCheckResult = {
      featureKey: "advanced_exports",
      granted: false,
      reason: "entitlement_not_found",
      status: "denied",
      type: "boolean",
    };

    const state = createBillingEntitlementAdminPanelState({
      account,
      entitlementChecks: [missingEntitlement],
      generatedAt,
      grantedPermissions: ["billing:read"],
      plan,
      requiredPermissions: ["billing:read"],
      subscription,
      tenantId: "tenant-1",
    });

    const markup = renderState(state);

    expect(markup).toContain('data-state="missing"');
    expect(markup).toContain("Missing");
    expect(markup).toContain("ENTITLEMENT_NOT_FOUND");
  });

  it("renders provider failures as a failure state with provider Problem details", () => {
    const providerFailure = createCoreProblemDetails({
      code: "billing-provider/unavailable",
      detail: "Polar API timed out while loading subscription state",
      source: "provider",
      status: 503,
      title: "Service Unavailable",
    });

    const state = createBillingEntitlementAdminPanelState({
      account,
      generatedAt,
      grantedPermissions: ["billing:read"],
      plan,
      provider: {
        providerName: "polar",
      },
      providerFailure,
      requiredPermissions: ["billing:read"],
      subscription,
      tenantId: "tenant-1",
    });

    expect(state.kind).toBe("provider_failure");

    const markup = renderState(state);

    expect(markup).toContain('data-testid="admin-provider-failure"');
    expect(markup).not.toContain('data-testid="admin-panel-ready"');
    expect(markup).toContain("billing-provider/unavailable");
    expect(markup).toContain("Polar API timed out");
    expect(markup).toContain('data-state="unavailable"');
  });

  it("normalizes provider problem input into a provider failure state", () => {
    const providerProblem = createCoreProblemDetails({
      code: "billing-provider/sync-failed",
      detail: "Provider sync failed before the admin snapshot was built",
      source: "provider",
      status: 503,
      title: "Service Unavailable",
    });

    const state = createBillingEntitlementAdminPanelState({
      account,
      generatedAt,
      grantedPermissions: ["billing:read"],
      plan,
      provider: {
        problem: providerProblem,
        providerName: "provider-neutral",
        status: "unavailable",
      },
      requiredPermissions: ["billing:read"],
      subscription,
      tenantId: "tenant-1",
    });

    expect(state.kind).toBe("provider_failure");

    const markup = renderState(state);

    expect(markup).toContain('data-testid="admin-provider-failure"');
    expect(markup).not.toContain('data-testid="admin-panel-ready"');
    expect(markup).toContain("billing-provider/sync-failed");
    expect(markup).toContain("Provider sync failed");
  });

  it("renders permission denial before exposing editable admin actions", () => {
    const syncProviderAction: AdminActionContract = {
      audit: {
        eventName: "billing.admin.provider_sync_requested",
        subjectId: "tenant-1",
        subjectType: "tenant",
      },
      id: "sync-provider",
      label: "Sync provider",
      mutability: "editable",
      permissions: ["billing:read"],
      possibleProblems: [
        {
          code: "billing-provider/unavailable",
          source: "provider",
        },
      ],
      source: "provider",
    };

    const state = createBillingEntitlementAdminPanelState({
      account,
      actions: [adjustPlanAction, syncProviderAction],
      generatedAt,
      grantedPermissions: ["billing:read"],
      plan,
      requiredPermissions: ["billing:read", "billing:write"],
      subscription,
      tenantId: "tenant-1",
    });

    expect(state.kind).toBe("permission_denied");

    const markup = renderState(state);

    expect(markup).toContain('data-testid="admin-permission-denied"');
    expect(markup).toContain("admin/permission-denied");
    expect(markup).toContain("billing:write");
    expect(markup).toContain('disabled=""');
    expect(markup.match(/disabled=""/g)?.length).toBe(2);
  });
});
