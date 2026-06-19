# @croco/admin-react

Provider-neutral React contracts and primitives for SaaS billing and entitlement
administration.

## Install

```bash
pnpm add @croco/admin-react
```

## Usage

```tsx
import {
  BillingEntitlementAdminPanel,
  createInMemoryBillingEntitlementAdminPanelState,
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

## Contract

- Croco plan, billing, entitlement, and quota state is represented separately from
  billing provider state.
- Provider state is read-only and provider failures render as `provider_failure`
  rather than an empty successful panel.
- Admin actions must declare permissions, audit metadata, mutability, source, and
  possible Problem codes.
- Permission failures render as `permission_denied` before editable actions are
  exposed.
