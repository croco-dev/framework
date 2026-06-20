import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CrocoAuthBridgeProvider,
  RequireEntitlement,
  RequirePermission,
  createFrontendAuthBridgeState,
  createFrontendProblemDetails,
  evaluateSessionGateState,
  useEntitlements,
  useTenant,
  type FrontendAuthBridgeState,
  type FrontendAuthGateState,
  type FrontendEntitlementState,
  type FrontendTenantState,
} from "../index";

const session = {
  user: {
    email: "admin@example.com",
    userId: "user-1",
  },
};

const tenant = {
  name: "Acme",
  tenantId: "tenant-1",
};

function renderWithState(state: FrontendAuthBridgeState, element: React.ReactElement): string {
  return renderToStaticMarkup(createElement(CrocoAuthBridgeProvider, { value: state }, element));
}

describe("frontend auth bridge", () => {
  it("renders permission-gated content only when session, tenant, permission, and entitlement checks are allowed", () => {
    const state = createFrontendAuthBridgeState({
      entitlements: [{ featureKey: "billing.pro", granted: true, source: "generated-client" }],
      permissions: [{ granted: true, permission: "billing:read", source: "generated-client" }],
      session,
      tenant,
    });

    const gate = evaluateSessionGateState(state, {
      entitlements: ["billing.pro"],
      permissions: ["billing:read"],
      tenantRequired: true,
    });
    const html = renderWithState(
      state,
      createElement(RequirePermission, {
        children: createElement("span", { "data-testid": "allowed-content" }, "Allowed"),
        permissions: "billing:read",
        tenantRequired: true,
      }),
    );

    expect(gate.kind).toBe("allowed");
    expect(html).toContain('data-testid="allowed-content"');
    expect(html).not.toContain("frontend-auth-denied");
  });

  it("keeps loading permission state separate from allowed rendering", () => {
    const state = createFrontendAuthBridgeState({
      permissions: { kind: "loading" },
      session,
      tenant,
    });

    const html = renderWithState(
      state,
      createElement(RequirePermission, {
        children: createElement("span", { "data-testid": "allowed-content" }, "Allowed"),
        permissions: "billing:read",
      }),
    );

    expect(html).toContain('data-croco-auth-state="loading"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-testid="allowed-content"');
  });

  it("preserves permission denial Problem details and recovery actions", () => {
    const problem = createFrontendProblemDetails({
      code: "access/permission-denied",
      detail: "billing:write is required",
      source: "access",
      status: 403,
      title: "Forbidden",
    });
    const state = createFrontendAuthBridgeState({
      permissions: [
        {
          granted: false,
          permission: "billing:write",
          problem,
          recoveryActions: [
            { href: "/request-access", id: "request-access", label: "Request access" },
          ],
          source: "generated-client",
        },
      ],
      session,
      tenant,
    });

    const html = renderWithState(
      state,
      createElement(RequirePermission, {
        children: createElement("span", { "data-testid": "allowed-content" }, "Allowed"),
        permissions: "billing:write",
      }),
    );

    expect(html).toContain('data-croco-auth-state="denied"');
    expect(html).toContain('data-problem-code="access/permission-denied"');
    expect(html).toContain("billing:write is required");
    expect(html).toContain("/request-access");
    expect(html).not.toContain('data-testid="allowed-content"');
  });

  it("does not let an unrelated denied permission mask a granted required permission", () => {
    const state = createFrontendAuthBridgeState({
      permissions: [
        { granted: true, permission: "billing:read" },
        { granted: false, permission: "billing:write" },
      ],
      session,
      tenant,
    });

    const gate = evaluateSessionGateState(state, { permissions: ["billing:read"] });

    expect(gate.kind).toBe("allowed");
  });

  it("aggregates permission and entitlement denial evidence in a combined gate", () => {
    const permissionProblem = createFrontendProblemDetails({
      code: "access/permission-denied",
      status: 403,
      title: "Permission denied",
    });
    const entitlementProblem = createFrontendProblemDetails({
      code: "entitlements/feature-denied",
      status: 403,
      title: "Entitlement denied",
    });
    const state = createFrontendAuthBridgeState({
      entitlements: [
        {
          featureKey: "billing.pro",
          granted: false,
          problem: entitlementProblem,
          recoveryActions: [{ href: "/upgrade", id: "upgrade", label: "Upgrade" }],
        },
      ],
      permissions: [
        {
          granted: false,
          permission: "billing:write",
          problem: permissionProblem,
          recoveryActions: [
            { href: "/request-access", id: "request-access", label: "Request access" },
          ],
        },
      ],
      session,
      tenant,
    });

    const gate = evaluateSessionGateState(state, {
      entitlements: ["billing.pro"],
      permissions: ["billing:write"],
    });

    expect(gate.kind).toBe("denied");
    expect(gate.kind === "denied" ? gate.missingPermissions : []).toEqual(["billing:write"]);
    expect(gate.kind === "denied" ? gate.missingEntitlements : []).toEqual(["billing.pro"]);
    expect(gate.kind === "denied" ? gate.problem?.code : undefined).toBe(
      "frontend-react/access-denied",
    );
    expect(gate.kind === "denied" ? gate.problem?.problems : undefined).toEqual([
      permissionProblem,
      entitlementProblem,
    ]);
    expect(
      gate.kind === "denied" ? gate.recoveryActions?.map((action) => action.id) : undefined,
    ).toEqual(["request-access", "upgrade"]);
  });

  it("models unauthenticated state without evaluating permission success", () => {
    const problem = createFrontendProblemDetails({
      code: "auth/session-missing",
      status: 401,
      title: "Sign in required",
    });
    const state = createFrontendAuthBridgeState({
      permissions: [{ granted: true, permission: "billing:read" }],
      session: {
        kind: "unauthenticated",
        problem,
        recoveryActions: [{ href: "/login", id: "login", label: "Sign in" }],
      },
      tenant,
    });

    const gate = evaluateSessionGateState(state, { permissions: ["billing:read"] });
    const html = renderWithState(
      state,
      createElement(RequirePermission, {
        children: createElement("span", { "data-testid": "allowed-content" }, "Allowed"),
        permissions: "billing:read",
      }),
    );

    expect(gate.kind).toBe("unauthenticated");
    expect(html).toContain('data-croco-auth-state="unauthenticated"');
    expect(html).toContain('data-problem-code="auth/session-missing"');
    expect(html).toContain("/login");
    expect(html).not.toContain('data-testid="allowed-content"');
  });

  it("preserves provider failures as unavailable entitlement state", () => {
    const problem = createFrontendProblemDetails({
      code: "entitlements/provider-unavailable",
      detail: "generated client returned 503",
      source: "provider",
      status: 503,
      title: "Entitlements unavailable",
    });
    const state = createFrontendAuthBridgeState({
      entitlements: {
        kind: "unavailable",
        problem,
        recoveryActions: [{ id: "retry", label: "Retry" }],
      },
      permissions: [{ granted: true, permission: "billing:read" }],
      session,
      tenant,
    });

    const html = renderWithState(
      state,
      createElement(RequireEntitlement, {
        children: createElement("span", { "data-testid": "allowed-content" }, "Allowed"),
        entitlements: "billing.pro",
      }),
    );

    expect(html).toContain('data-croco-auth-state="unavailable"');
    expect(html).toContain('data-problem-code="entitlements/provider-unavailable"');
    expect(html).toContain("generated client returned 503");
    expect(html).toContain("Retry");
    expect(html).not.toContain('data-testid="allowed-content"');
  });

  it("exposes tenant and entitlement hooks over the provider-neutral state", () => {
    const state = createFrontendAuthBridgeState({
      entitlements: [
        {
          featureKey: "analytics.export",
          granted: false,
          problem: createFrontendProblemDetails({
            code: "entitlements/missing",
            status: 403,
            title: "Missing entitlement",
          }),
        },
      ],
      permissions: [{ granted: true, permission: "analytics:read" }],
      session,
      tenant,
    });
    let capturedTenant: FrontendTenantState | undefined;
    let capturedEntitlements: FrontendAuthGateState | undefined;
    let rawEntitlements: FrontendEntitlementState | undefined;

    function Probe() {
      capturedTenant = useTenant();
      rawEntitlements = useEntitlements();
      capturedEntitlements = useEntitlements(["analytics.export"]);

      return null;
    }

    renderWithState(state, createElement(Probe));

    expect(capturedTenant?.kind).toBe("available");
    expect(rawEntitlements?.kind).toBe("denied");
    expect(capturedEntitlements?.kind).toBe("denied");
    expect(
      capturedEntitlements?.kind === "denied" ? capturedEntitlements.problem?.code : undefined,
    ).toBe("entitlements/missing");
  });
});
