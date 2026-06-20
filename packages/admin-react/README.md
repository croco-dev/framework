# @croco/admin-react

Provider-neutral React contracts and primitives for SaaS billing, entitlement,
tenant switching, impersonation, and permission inspection administration.

## Install

```bash
pnpm add @croco/admin-react
```

## Usage

```tsx
import {
  BillingEntitlementAdminPanel,
  createInMemoryBillingEntitlementAdminPanelState,
  createInMemoryTenantImpersonationConsoleState,
  TenantImpersonationConsole,
} from "@croco/admin-react";

const state = createInMemoryBillingEntitlementAdminPanelState({
  tenantId: "tenant-1",
  requiredPermissions: ["billing:read"],
  grantedPermissions: ["billing:read"],
  plan,
  account,
  subscription,
  entitlementChecks,
  usageMeters,
  provider: { providerName: "polar" },
  actions: [
    {
      id: "adjust-plan",
      label: "Adjust plan",
      source: "croco",
      mutability: "editable",
      permissions: ["billing:write"],
      audit: {
        eventName: "billing.admin.plan_adjusted",
        subjectType: "tenant",
        subjectId: "tenant-1",
      },
      possibleProblems: [{ code: "billing/subscription-not-found", source: "billing" }],
    },
  ],
});

export function TenantBillingPanel() {
  return <BillingEntitlementAdminPanel state={state} />;
}
```

```tsx
const tenantConsoleState = createInMemoryTenantImpersonationConsoleState({
  tenant: {
    id: "tenant-1",
    slug: "acme",
    name: "Acme",
    status: "active",
  },
  tenants: [
    { tenant: { id: "tenant-1", slug: "acme", name: "Acme", status: "active" } },
    {
      tenant: { id: "tenant-2", slug: "globex", name: "Globex", status: "trial" },
      switchAction: {
        id: "switch-tenant-2",
        label: "Switch to Globex",
        source: "croco",
        mutability: "editable",
        permissions: ["tenant:switch"],
        audit: {
          eventName: "tenant.admin.switched",
          subjectType: "tenant",
          subjectId: "tenant-2",
        },
        possibleProblems: [{ code: "tenant/required", source: "tenant" }],
      },
    },
  ],
  requiredPermissions: ["tenant:read"],
  grantedPermissions: ["tenant:read", "tenant:switch", "impersonation:stop"],
  permissions: [
    { permission: "tenant:read", state: "allowed" },
    { permission: "impersonation:start", state: "denied" },
  ],
  impersonation: {
    kind: "active",
    session,
    impersonator: { userId: "admin-1", label: "Ops Admin" },
    target: { userId: "user-1", label: "Customer User" },
    exitAction: {
      id: "exit-impersonation",
      label: "Exit impersonation",
      source: "croco",
      mutability: "editable",
      permissions: ["impersonation:stop"],
      audit: {
        eventName: "impersonation.admin.exited",
        subjectType: "impersonation-session",
        subjectId: session.sessionId,
      },
      possibleProblems: [{ code: "IMPERSONATION_SESSION_NOT_FOUND", source: "impersonation" }],
    },
  },
});

export function TenantAdminConsole() {
  return <TenantImpersonationConsole state={tenantConsoleState} />;
}
```

## Contract

- Croco plan, billing, entitlement, and quota state is represented separately from
  billing provider state.
- Provider state is read-only and provider failures render as `provider_failure`
  rather than an empty successful panel.
- Admin actions must declare permissions, audit metadata, mutability, source, and
  possible Problem codes.
- Permission failures render as `permission_denied` before editable actions are
  exposed.
- Tenant switching uses explicit tenant option and switch action contracts.
- Impersonation renders `inactive`, `active`, `expired`, and `unavailable`
  states separately; active and expired sessions require an audited exit action.
- Tenant isolation, provider, and permission inspection failures preserve Croco
  Problem details instead of rendering a normal success state.
