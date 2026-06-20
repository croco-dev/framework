import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TenantImpersonationConsole } from "../libs/components";
import { createCoreProblemDetails, createTenantImpersonationConsoleState } from "../libs/snapshot";
import type { AdminActionContract, TenantImpersonationConsoleState } from "../libs/types";

const generatedAt = new Date("2026-06-20T00:00:00.000Z");
const tenantOne = {
  id: "tenant-1",
  name: "Acme",
  slug: "acme",
  status: "active",
} as const;
const tenantTwo = {
  id: "tenant-2",
  name: "Globex",
  slug: "globex",
  status: "trial",
} as const;

const switchTenantAction: AdminActionContract = {
  audit: {
    eventName: "tenant.admin.switched",
    subjectId: "tenant-2",
    subjectType: "tenant",
  },
  id: "switch-tenant-2",
  label: "Switch to Globex",
  mutability: "editable",
  permissions: ["tenant:switch"],
  possibleProblems: [
    {
      code: "tenant/required",
      source: "tenant",
    },
  ],
  source: "croco",
};

const exitImpersonationAction: AdminActionContract = {
  audit: {
    eventName: "impersonation.admin.exited",
    subjectId: "imp-session-1",
    subjectType: "impersonation-session",
    metadata: {
      recovery: "exit",
    },
  },
  id: "exit-impersonation",
  label: "Exit impersonation",
  mutability: "editable",
  permissions: ["impersonation:stop"],
  possibleProblems: [
    {
      code: "IMPERSONATION_SESSION_NOT_FOUND",
      source: "impersonation",
    },
  ],
  source: "croco",
};

function renderState(state: TenantImpersonationConsoleState): string {
  return renderToStaticMarkup(createElement(TenantImpersonationConsole, { state }));
}

describe("TenantImpersonationConsole", () => {
  it("renders tenant switching and permission inspection as typed admin state", () => {
    const permissionProblem = createCoreProblemDetails({
      code: "access/tenant-admin-denied",
      detail: "The operator cannot impersonate users in this tenant",
      source: "permissions",
      status: 403,
      title: "Forbidden",
    });

    const state = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read", "tenant:switch"],
      permissions: [
        {
          permission: "tenant:read",
          state: "allowed",
        },
        {
          permission: "impersonation:start",
          problem: permissionProblem,
          requiredFor: "Start impersonation",
          state: "denied",
        },
      ],
      requiredPermissions: ["tenant:read"],
      tenant: tenantOne,
      tenants: [{ tenant: tenantOne }, { switchAction: switchTenantAction, tenant: tenantTwo }],
    });

    expect(state.kind).toBe("active");
    if (state.kind !== "active") {
      return;
    }

    expect(state.tenant.tenantId).toBe("tenant-1");
    expect(state.tenants[1]?.switchAction?.audit.eventName).toBe("tenant.admin.switched");
    expect(state.permissions[1]?.problem).toBe(permissionProblem);

    const markup = renderState(state);

    expect(markup).toContain('data-testid="tenant-switcher"');
    expect(markup).toContain('data-active-tenant-id="tenant-1"');
    expect(markup).toContain('data-tenant-id="tenant-2"');
    expect(markup).toContain('data-audit-event="tenant.admin.switched"');
    expect(markup).toContain('data-testid="permission-inspector"');
    expect(markup).toContain('data-permission="impersonation:start"');
    expect(markup).toContain("access/tenant-admin-denied");
  });

  it("renders active impersonation as visually and programmatically distinct", () => {
    const state = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read", "impersonation:stop"],
      impersonation: {
        exitAction: exitImpersonationAction,
        impersonator: { label: "Ops Admin", userId: "admin-1" },
        kind: "active",
        session: {
          expiresAt: new Date("2026-06-20T00:30:00.000Z"),
          impersonatorId: "admin-1",
          reason: "Investigate support ticket 123",
          sessionId: "imp-session-1",
          startedAt: generatedAt,
          targetUserId: "user-1",
        },
        target: { label: "Customer User", userId: "user-1" },
      },
      requiredPermissions: ["tenant:read"],
      tenant: tenantOne,
    });

    expect(state.kind).toBe("active");
    if (state.kind !== "active") {
      return;
    }
    expect(state.impersonation.kind).toBe("active");

    const markup = renderState(state);

    expect(markup).toContain('data-testid="impersonation-banner"');
    expect(markup).toContain('data-impersonation-active="true"');
    expect(markup).toContain('data-impersonation-session-id="imp-session-1"');
    expect(markup).toContain("Ops Admin is viewing Customer User");
    expect(markup).toContain('data-action-id="exit-impersonation"');
    expect(markup).toContain('data-audit-event="impersonation.admin.exited"');
  });

  it("disables impersonation exit when the operator lacks the action permission", () => {
    const state = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read"],
      impersonation: {
        exitAction: exitImpersonationAction,
        kind: "active",
        session: {
          expiresAt: new Date("2026-06-20T00:30:00.000Z"),
          impersonatorId: "admin-1",
          reason: "Investigate support ticket 123",
          sessionId: "imp-session-1",
          startedAt: generatedAt,
          targetUserId: "user-1",
        },
      },
      requiredPermissions: ["tenant:read"],
      tenant: tenantOne,
    });

    const markup = renderState(state);

    expect(markup).toContain('data-action-id="exit-impersonation"');
    expect(markup).toContain('title="Missing permissions: impersonation:stop"');
    expect(markup).toContain('disabled=""');
  });

  it("keeps expired impersonation in a recovery state with the exit action", () => {
    const state = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read", "impersonation:stop"],
      impersonation: {
        exitAction: exitImpersonationAction,
        kind: "active",
        session: {
          expiresAt: new Date("2026-06-19T23:59:59.000Z"),
          impersonatorId: "admin-1",
          reason: "Expired support session",
          sessionId: "imp-session-1",
          startedAt: new Date("2026-06-19T23:00:00.000Z"),
          targetUserId: "user-1",
        },
      },
      requiredPermissions: ["tenant:read"],
      tenant: tenantOne,
    });

    expect(state.kind).toBe("active");
    if (state.kind !== "active") {
      return;
    }
    expect(state.impersonation.kind).toBe("expired");

    const markup = renderState(state);

    expect(markup).toContain('data-state="expired"');
    expect(markup).toContain('data-impersonation-active="false"');
    expect(markup).toContain("admin/impersonation-expired");
    expect(markup).toContain('data-action-id="exit-impersonation"');
  });

  it("renders loading separately from active console state", () => {
    const state = createTenantImpersonationConsoleState({
      generatedAt,
      loading: true,
      selectedTenantId: "tenant-1",
    });

    expect(state.kind).toBe("loading");

    const markup = renderState(state);

    expect(markup).toContain('data-testid="tenant-impersonation-console-loading"');
    expect(markup).toContain('data-state="loading"');
    expect(markup).not.toContain('data-testid="tenant-impersonation-console-active"');
  });

  it("preserves permission denial Problem details before exposing actions", () => {
    const permissionProblem = createCoreProblemDetails({
      code: "admin/tenant-console-denied",
      detail: "Operator is missing tenant console access",
      source: "permissions",
      status: 403,
      title: "Forbidden",
    });

    const state = createTenantImpersonationConsoleState({
      actions: [switchTenantAction],
      generatedAt,
      grantedPermissions: ["tenant:read"],
      permissionProblem,
      requiredPermissions: ["tenant:read", "tenant:admin"],
      tenant: tenantOne,
    });

    expect(state.kind).toBe("denied");
    if (state.kind !== "denied") {
      return;
    }
    expect(state.problem).toBe(permissionProblem);

    const markup = renderState(state);

    expect(markup).toContain('data-testid="tenant-impersonation-console-denied"');
    expect(markup).toContain("admin/tenant-console-denied");
    expect(markup).toContain("Missing permissions: tenant:admin");
    expect(markup).not.toContain("Missing permissions: tenant:read, tenant:admin");
    expect(markup).toContain('disabled=""');
  });

  it("preserves tenant isolation failure details as an unavailable console state", () => {
    const isolationProblem = createCoreProblemDetails({
      code: "tenant-core/cross-tenant-leak",
      detail: "Expected tenant-1 but received tenant-2",
      source: "tenant-isolation",
      status: 500,
      title: "Tenant isolation failure",
    });

    const state = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read"],
      requiredPermissions: ["tenant:read"],
      tenant: tenantOne,
      tenantIsolationProblem: isolationProblem,
    });

    expect(state.kind).toBe("unavailable");
    if (state.kind !== "unavailable") {
      return;
    }
    expect(state.problem).toBe(isolationProblem);

    const markup = renderState(state);

    expect(markup).toContain('data-testid="tenant-impersonation-console-unavailable"');
    expect(markup).toContain("tenant-core/cross-tenant-leak");
    expect(markup).toContain("Expected tenant-1 but received tenant-2");
    expect(markup).not.toContain('data-testid="tenant-impersonation-console-active"');
  });

  it("does not mask unavailable failure Problems behind permission denial", () => {
    const isolationProblem = createCoreProblemDetails({
      code: "tenant-core/unsafe-query",
      detail: "Tenant query omitted the active tenant predicate",
      source: "tenant-isolation",
      status: 403,
      title: "Forbidden",
    });
    const providerFailure = createCoreProblemDetails({
      code: "admin/tenant-provider-unavailable",
      detail: "Tenant directory API timed out",
      source: "provider",
      status: 503,
      title: "Service Unavailable",
    });

    const isolationState = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read"],
      requiredPermissions: ["tenant:read", "tenant:admin"],
      tenant: tenantOne,
      tenantIsolationProblem: isolationProblem,
    });
    const providerState = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read"],
      providerFailure,
      requiredPermissions: ["tenant:read", "tenant:admin"],
      tenant: tenantOne,
    });
    const missingTenantState = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: [],
      requiredPermissions: ["tenant:read"],
      selectedTenantId: "tenant-unknown",
    });

    expect(isolationState.kind).toBe("unavailable");
    expect(providerState.kind).toBe("unavailable");
    expect(missingTenantState.kind).toBe("unavailable");
    if (
      isolationState.kind !== "unavailable" ||
      providerState.kind !== "unavailable" ||
      missingTenantState.kind !== "unavailable"
    ) {
      return;
    }

    expect(isolationState.problem).toBe(isolationProblem);
    expect(providerState.problem).toBe(providerFailure);
    expect(missingTenantState.problem.code).toBe("admin/tenant-context-unavailable");

    expect(renderState(isolationState)).toContain("tenant-core/unsafe-query");
    expect(renderState(providerState)).toContain("admin/tenant-provider-unavailable");
    expect(renderState(missingTenantState)).toContain("admin/tenant-context-unavailable");
  });

  it("preserves provider failure details as an unavailable console state", () => {
    const providerFailure = createCoreProblemDetails({
      code: "admin/tenant-provider-unavailable",
      detail: "Tenant directory API timed out",
      source: "provider",
      status: 503,
      title: "Service Unavailable",
    });

    const state = createTenantImpersonationConsoleState({
      generatedAt,
      grantedPermissions: ["tenant:read"],
      providerFailure,
      requiredPermissions: ["tenant:read"],
      tenant: tenantOne,
    });

    expect(state.kind).toBe("unavailable");
    if (state.kind !== "unavailable") {
      return;
    }
    expect(state.problem).toBe(providerFailure);

    const markup = renderState(state);

    expect(markup).toContain('data-testid="tenant-impersonation-console-unavailable"');
    expect(markup).toContain("admin/tenant-provider-unavailable");
    expect(markup).toContain("Tenant directory API timed out");
  });
});
