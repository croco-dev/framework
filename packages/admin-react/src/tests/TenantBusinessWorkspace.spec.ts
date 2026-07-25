import { createElement, type KeyboardEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createTenantWorkspaceActionHandler,
  createTenantWorkspaceRefreshHandler,
  handleTenantWorkspaceTabKeyDown,
  resolveTenantWorkspaceTabKey,
} from "../libs/TenantBusinessWorkspace";
import { createTenantWorkspaceActionRequest, TenantBusinessWorkspace } from "../index";
import type {
  AdminAction,
  TenantWorkspaceSnapshot,
  TenantWorkspaceSourceState,
} from "@croco/admin-core";

const generatedAt = new Date("2026-07-26T00:00:00.000Z");

const writeAction: AdminAction = {
  audit: {
    actor: "required",
    eventName: "tenant.subscription.resumed",
    idempotencyKey: "required",
    reason: "required",
    subjectType: "tenant",
  },
  id: "resume-subscription",
  idempotency: "required",
  kind: "enable",
  label: "Resume subscription",
  mutability: "write",
  permissions: [{ permissions: ["billing:write"] }],
  problems: [
    {
      code: "billing/resume-failed",
      recoveryActionId: "refresh-billing",
      retryable: true,
    },
  ],
  target: "record",
};

const recoveryAction: AdminAction = {
  ...writeAction,
  audit: { ...writeAction.audit, eventName: "tenant.failed-work.retried" },
  id: "retry-failed-work",
  kind: "retry",
  label: "Retry failed work",
  permissions: [{ permissions: ["tenant:read"] }],
};

const refreshBillingAction: AdminAction = {
  ...recoveryAction,
  audit: { ...recoveryAction.audit, eventName: "tenant.billing.refreshed" },
  id: "refresh-billing",
  label: "Refresh billing",
};

function ready(
  sourceId: string,
  label: string,
  section: TenantWorkspaceSourceState["section"],
  state: Extract<TenantWorkspaceSourceState, { kind: "ready" }>["state"],
): TenantWorkspaceSourceState {
  return {
    kind: "ready",
    label,
    loadedAt: generatedAt,
    section,
    sourceId,
    state,
  };
}

function createFixture(): TenantWorkspaceSnapshot {
  return {
    actions: [
      {
        action: writeAction,
        availability: { kind: "enabled" },
        permission: {
          grantedPermissions: ["tenant:read"],
          kind: "denied",
          missingPermissions: ["billing:write"],
          unresolvedRequirements: [],
        },
      },
      {
        action: refreshBillingAction,
        availability: { kind: "enabled" },
        permission: { grantedPermissions: ["tenant:read"], kind: "allowed" },
      },
    ],
    generatedAt,
    grantedPermissions: ["tenant:read"],
    sources: [
      ready("identity", "Identity", "overview", {
        fields: [
          {
            id: "owner-email",
            label: "Owner email",
            maskedValue: "o***@example.com",
            sensitive: true,
            visibility: "masked",
          },
          {
            id: "tax-id",
            label: "Tax ID",
            sensitive: true,
            visibility: "denied",
          },
        ],
        kind: "identity",
        name: "Acme",
        status: "active",
        tenantId: "tenant-acme",
      }),
      ready("billing", "Billing", "billing", {
        detailHref: "/tenants/tenant-acme/billing",
        kind: "subscription",
        planId: "growth",
        planName: "Growth",
        planVersionId: "growth-v4",
        providerState: "read-only",
        status: "past_due",
        subscriptionId: "sub-1",
      }),
      ready("usage", "Usage", "usage", {
        detailHref: "/tenants/tenant-acme/usage",
        kind: "usage",
        meters: [
          {
            classification: "billable",
            forecast: 130,
            forecastState: "over-limit",
            id: "api-calls",
            label: "API calls",
            limit: 100,
            percent: 120,
            usage: 120,
          },
        ],
        overLimitCount: 1,
        warningCount: 1,
      }),
      ready("members", "Members", "members", {
        activeMembers: 10,
        detailHref: "/tenants/tenant-acme/members",
        kind: "membership",
        seatLimit: 10,
        seatPercent: 100,
      }),
      ready("health", "Health", "overview", {
        detailHref: "/tenants/tenant-acme/health",
        kind: "health",
        score: 41,
        signals: [
          {
            contribution: -25,
            id: "failed-work",
            label: "Failed work",
            trend: "deteriorating",
          },
        ],
        state: "at-risk",
        trend: "deteriorating",
      }),
      {
        kind: "stale",
        label: "Onboarding",
        loadedAt: generatedAt,
        section: "onboarding",
        sourceId: "onboarding",
        staleAt: new Date("2026-07-26T01:00:00.000Z"),
        state: {
          completedSteps: 2,
          kind: "onboarding",
          percent: 50,
          state: "blocked",
          totalSteps: 4,
        },
      },
      {
        kind: "unavailable",
        label: "Operations",
        problem: {
          code: "operations/provider-unavailable",
          detail: "The fake operations provider is unavailable.",
          status: 503,
          title: "Operations unavailable",
          type: "operations/provider-unavailable",
        },
        retryable: true,
        section: "operations",
        sourceId: "operations",
      },
      {
        grantedPermissions: ["tenant:read"],
        kind: "permission-denied",
        label: "Entitlements",
        problem: {
          code: "admin-core/tenant-source-permission-denied",
          status: 403,
          title: "Permission denied",
          type: "admin-core/tenant-source-permission-denied",
        },
        requiredPermissions: ["entitlements:read"],
        section: "entitlements",
        sourceId: "entitlements",
      },
      {
        kind: "problem",
        label: "Failed work",
        problem: {
          code: "operations/retryable-query-failed",
          detail: "Retry the failed-work query.",
          status: 503,
          title: "Failed work query failed",
          type: "operations/retryable-query-failed",
        },
        recoveryActions: [
          {
            action: recoveryAction,
            availability: { kind: "enabled" },
            permission: {
              grantedPermissions: ["tenant:read"],
              kind: "allowed",
            },
          },
        ],
        section: "operations",
        sourceId: "failed-work",
      },
      ready("failed-work-summary", "Failed work summary", "operations", {
        detailHref: "/tenants/tenant-acme/operations?state=failed",
        failedOperations: 2,
        kind: "failed-work",
        openProblems: 3,
        retryableOperations: 1,
      }),
      ready("engagement", "Engagement", "engagement", {
        contractId: "engagement/customer-360",
        extensionId: "engagement",
        kind: "extension",
        label: "Customer communication",
        slot: "tab",
        state: { recipientCount: 3 },
      }),
    ],
    tenantId: "tenant-acme",
  };
}

describe("TenantBusinessWorkspace", () => {
  it("renders accessible tenant landmarks, tabs, badges, links, and partial source states", () => {
    const markup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, {
        onRefreshSource: () => undefined,
        renderExtension: (extension) =>
          createElement(
            "p",
            { "data-extension": extension.contractId },
            "Engagement panel mounted",
          ),
        state: createFixture(),
      }),
    );

    expect(markup).toContain('aria-label="Tenant 360 business workspace"');
    expect(markup).toContain("<h1>Acme</h1>");
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain("Plan version</dt><dd>growth-v4");
    expect(markup).toContain("Health</dt><dd>at-risk (41)");
    expect(markup).toContain("Seats</dt><dd>10 of 10");
    expect(markup).toContain("Status: past_due");
    expect(markup).toContain("1 forecast warning(s); 1 over limit");
    expect(markup).toContain('data-state="stale"');
    expect(markup).toContain('data-state="unavailable"');
    expect(markup).toContain('data-state="permission-denied"');
    expect(markup).toContain('data-state="problem"');
    expect(markup).toContain('aria-label="Failed work recovery actions"');
    expect(markup).toContain('data-action-id="retry-failed-work"');
    expect(markup).toContain('title="No action handler is configured."');
    expect(markup).toContain('href="/tenants/tenant-acme/usage"');
    expect(markup).toContain('href="/tenants/tenant-acme/billing"');
    expect(markup).toContain('href="/tenants/tenant-acme/members"');
    expect(markup).toContain('href="/tenants/tenant-acme/health"');
    expect(markup).toContain('href="/tenants/tenant-acme/operations?state=failed"');
    expect(markup).toContain('aria-label="Refresh Usage"');
    expect(markup).toContain('data-extension="engagement/customer-360"');
  });

  it("renders the healthy fixture state without losing source-specific evidence", () => {
    const fixture = createFixture();
    const sources = fixture.sources.map((source) =>
      source.kind === "ready" && source.state.kind === "health"
        ? {
            ...source,
            state: {
              ...source.state,
              score: 94,
              state: "healthy" as const,
              trend: "improving" as const,
            },
          }
        : source,
    );
    const markup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, { state: { ...fixture, sources } }),
    );

    expect(markup).toContain("Health</dt><dd>healthy (94)");
    expect(markup).toContain("Score 94 · healthy · improving");
  });

  it("resolves wrapping arrow, Home, and End keyboard navigation", () => {
    const sections = [{ id: "overview" }, { id: "usage" }, { id: "billing" }] as const;

    expect(resolveTenantWorkspaceTabKey("ArrowLeft", sections, 0)).toBe("billing");
    expect(resolveTenantWorkspaceTabKey("ArrowRight", sections, 2)).toBe("overview");
    expect(resolveTenantWorkspaceTabKey("Home", sections, 2)).toBe("overview");
    expect(resolveTenantWorkspaceTabKey("End", sections, 0)).toBe("billing");
    expect(resolveTenantWorkspaceTabKey("Enter", sections, 0)).toBeUndefined();
  });

  it("routes source refresh, recovery actions, and keyboard focus through exact handlers", () => {
    const onRefreshSource = vi.fn();
    createTenantWorkspaceRefreshHandler("usage", onRefreshSource)();
    expect(onRefreshSource).toHaveBeenCalledWith("usage");

    const onAction = vi.fn();
    createTenantWorkspaceActionHandler(
      {
        action: recoveryAction,
        availability: { kind: "enabled" },
        permission: { grantedPermissions: ["tenant:read"], kind: "allowed" },
      },
      onAction,
    )?.();
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: recoveryAction,
        requiredInput: { idempotencyKey: true, reason: true },
      }),
    );
    expect(
      createTenantWorkspaceActionHandler(
        {
          action: recoveryAction,
          availability: { kind: "enabled" },
          permission: {
            grantedPermissions: [],
            kind: "denied",
            missingPermissions: ["tenant:read"],
            unresolvedRequirements: [],
          },
        },
        onAction,
      ),
    ).toBeUndefined();
    expect(
      createTenantWorkspaceActionHandler(
        {
          action: recoveryAction,
          availability: { kind: "enabled" },
          permission: { grantedPermissions: ["tenant:read"], kind: "allowed" },
        },
        undefined,
      ),
    ).toBeUndefined();
    const conditionalAction = { ...recoveryAction, disabledWhen: "tenant.status != 'active'" };
    expect(
      createTenantWorkspaceActionHandler(
        {
          action: conditionalAction,
          availability: { kind: "enabled" },
          permission: { grantedPermissions: ["tenant:read"], kind: "allowed" },
        },
        onAction,
      ),
    ).toBeTypeOf("function");

    const focus = vi.fn();
    const preventDefault = vi.fn();
    const onSectionChange = vi.fn();
    const event = {
      currentTarget: {
        parentElement: {
          querySelectorAll: () => [{ focus: vi.fn() }, { focus }],
        },
      },
      key: "ArrowRight",
      preventDefault,
    } as unknown as KeyboardEvent<HTMLButtonElement>;
    handleTenantWorkspaceTabKeyDown(
      event,
      [{ id: "overview" }, { id: "usage" }],
      0,
      onSectionChange,
    );
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onSectionChange).toHaveBeenCalledWith("usage");
    expect(focus).toHaveBeenCalledOnce();
  });

  it("never renders denied sensitive values and renders masked values only", () => {
    const markup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, { state: createFixture() }),
    );

    expect(markup).toContain("Owner email: o***@example.com");
    expect(markup).toContain("Tax ID: Permission required");
    expect(markup).not.toContain("owner@example.com");
    expect(markup).not.toContain("secret-tax-value");
  });

  it("requires snapshot permission evidence before rendering a visible sensitive field", () => {
    const fixture = createFixture();
    const sources = fixture.sources.map((source) =>
      source.kind === "ready" && source.state.kind === "identity"
        ? {
            ...source,
            state: {
              ...source.state,
              fields: [
                {
                  id: "owner-email",
                  label: "Owner email",
                  requiredPermissions: ["tenant:pii:read"],
                  sensitive: true,
                  value: "owner@example.com",
                  visibility: "visible" as const,
                },
              ],
            },
          }
        : source,
    );
    const markup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, { state: { ...fixture, sources } }),
    );

    expect(markup).not.toContain("owner@example.com");
    expect(markup).toContain("Owner email: Permission required");
  });

  it("keeps explicitly denied actions visible but disabled with permission evidence", () => {
    const markup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, { state: createFixture() }),
    );

    expect(markup).toContain('data-action-id="resume-subscription"');
    expect(markup).toContain('title="Missing permissions: billing:write"');
    expect(markup).toContain('disabled=""');
  });

  it("derives confirmation inputs and possible Problems from the AdminAction descriptor", () => {
    expect(createTenantWorkspaceActionRequest(writeAction)).toEqual({
      action: writeAction,
      possibleProblems: writeAction.problems,
      requiredInput: {
        idempotencyKey: true,
        reason: true,
      },
    });
    expect(
      createTenantWorkspaceActionRequest({ ...writeAction, idempotency: undefined }).requiredInput
        .idempotencyKey,
    ).toBe(true);
  });

  it("describes only the confirmation inputs declared by the action", () => {
    const fixture = createFixture();
    const requiredMarkup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, {
        actionResult: { actionId: writeAction.id, kind: "confirming" },
        state: fixture,
      }),
    );
    expect(requiredMarkup).toContain(
      "Confirm resume-subscription with audit reason and idempotency key.",
    );

    const inspectAction: AdminAction = {
      ...writeAction,
      audit: {
        actor: "required",
        eventName: "tenant.inspected",
        subjectType: "tenant",
      },
      id: "inspect-tenant",
      idempotency: "not-supported",
      kind: "inspect",
      mutability: "read",
    };
    const optionalMarkup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, {
        actionResult: { actionId: inspectAction.id, kind: "confirming" },
        state: {
          ...fixture,
          actions: [
            {
              action: inspectAction,
              availability: { kind: "enabled" },
              permission: { grantedPermissions: ["tenant:read"], kind: "allowed" },
            },
          ],
        },
      }),
    );
    expect(optionalMarkup).toContain("Confirm inspect-tenant. No additional inputs are required.");
  });

  it("preserves action Problem and recovery state in the result flow", () => {
    const onAction = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, {
        actionResult: {
          actionId: "resume-subscription",
          kind: "problem",
          problem: {
            code: "billing/resume-failed",
            detail: "Provider rejected the resume request.",
            status: 409,
            title: "Resume failed",
            type: "billing/resume-failed",
          },
          recoveryActionId: "refresh-billing",
        },
        onAction,
        state: createFixture(),
      }),
    );

    expect(markup).toContain('data-problem-type="billing/resume-failed"');
    expect(markup).toContain('aria-label="Action recovery"');
    expect(markup).toContain('data-action-id="refresh-billing"');

    const unknownMarkup = renderToStaticMarkup(
      createElement(TenantBusinessWorkspace, {
        actionResult: {
          actionId: "resume-subscription",
          kind: "problem",
          problem: {
            code: "billing/resume-failed",
            status: 409,
            title: "Resume failed",
            type: "billing/resume-failed",
          },
          recoveryActionId: "missing-action",
        },
        state: createFixture(),
      }),
    );
    expect(unknownMarkup).toContain("Recovery action unavailable: missing-action");
  });
});
