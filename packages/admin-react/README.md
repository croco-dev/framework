# @croco/admin-react

Provider-neutral React contracts and primitives for SaaS billing, entitlement,
tenant switching, impersonation, and permission inspection administration.
Also includes contract-aware admin resource tables.

## Monetization plan releases

`PlanReleaseConsole` renders the React-independent `PlanReleaseConsoleState` contract for editing,
validating, reviewing, scheduling, and publishing immutable billing plan versions. The editor renders
only code-declared fields and catalog options, so browser operators cannot invent meter, entitlement,
pricing-component, or provider-binding keys.

```tsx
import { PlanReleaseConsole } from "@croco/admin-react";

export function PlanReleaseOperations() {
  return (
    <PlanReleaseConsole
      state={state}
      command={{
        actorId: operator.id,
        reason,
        idempotencyKey,
        scheduledFor,
      }}
      onEdit={(request) => updateDraft(request)}
      onAction={(action, request) => executeReleaseAction(action, request)}
      onRequestConfirmation={(action) => confirmDestructiveAction(action)}
    />
  );
}
```

Semantic review groups price, seat, usage, entitlement, trial, provider, and effective-time changes
without exposing raw JSON. Blocking diagnostics use alert semantics and remain separate from warnings;
credential-free structural checks remain separate from remote-provider preflight. Impact items identify
facts versus estimates for new subscriptions, grandfathered subscriptions, and selected cohorts.

Publish and schedule actions require a current reviewed draft revision, explicit permission, actor,
reason, and idempotency key. A draft mutation invalidates the earlier review. Stale conflicts preserve
the local draft alongside the latest server snapshot, provider/repository failures remain typed Problems,
and successful publication renders an immutable receipt with audit and validation evidence.

## Tenant credit operations

`CreditOperationsConsole` renders the React-independent `CreditOperationsState`
from `@croco/admin-core`. The balance summary is bound to one ledger position and
keeps available, reserved, consumed, expired, and expiring-soon credits separate.
Grant lots, reservations, transactions, allocation evidence, related consumption
and refund links, actor, correlation, meter, and permission-safe references remain
inspectable without exposing a mutable balance editor.

```tsx
import { loadCreditOperations } from "@croco/admin-core";
import { CreditOperationsConsole } from "@croco/admin-react";

const state = await loadCreditOperations({
  tenantId: "tenant-1",
  source: creditOperationsSource,
  grantedPermissions: ["credits:read", "credits:write", "credits:refund"],
});

export function TenantCredits() {
  return (
    <CreditOperationsConsole
      state={state}
      onAction={(action) => openAuditedCreditConfirmation(action)}
      onRefresh={() => refreshCreditLedger()}
    />
  );
}
```

Grant, refund, release, and compensating adjustment requests require explicit
permission, actor, reason, idempotency key, semantic reference, and expected
ledger position. Refund and release actions exist only when the source declares
the underlying consumption or reservation eligible. Duplicate-conflict,
stale-position, committed-event-publication, and other possible Problems remain
declared on the action. Sensitive references resolve to visible, masked, or
denied values according to field permission evidence. Loading, empty, partial
history, permission-denied, stale, and provider/store failure states are distinct.
`createCreditOperationsTenantExtension()` mounts the same state through the
`credits/tenant-operations` Tenant 360 extension contract.

## Lifecycle automation operations

`LifecycleAutomationConsole` renders React-independent operation state derived
from `@croco/lifecycle-core` and recovery evidence from `@croco/admin-ops`.
Rules expose exact versions, executable and descriptor fingerprints, semantic
descriptor diffs, unavailable code registrations, and audited
activate/pause/resume/supersede controls. Every write requires permission,
actor, reason, idempotency key, optimistic revision, and the reviewed descriptor
fingerprint; stale intent fails before mutation.

```tsx
import {
  createLifecycleAutomationSource,
  LifecycleAutomationConsole,
  loadLifecycleAutomationConsole,
} from "@croco/admin-react";

const source = createLifecycleAutomationSource({
  registry,
  evaluator,
  runStore,
  fixtures: [
    {
      id: "at-risk-tenant",
      label: "Stored redacted at-risk tenant",
      resolve: () => loadServerValidatedContextFixture(),
    },
  ],
  listRecoveryItems: () => retryConsole.list({ includeSucceeded: true }),
});

const state = await loadLifecycleAutomationConsole({
  source,
  grantedPermissions: ["lifecycle:read", "lifecycle:write", "lifecycle:dry-run"],
});

export function LifecycleOperations() {
  return (
    <LifecycleAutomationConsole
      state={state}
      onRuleAction={(action) => openAuditedConfirmation(action)}
      onDryRunFixture={(fixtureId) => requestDryRun(fixtureId)}
      onRecoverRun={(run) => openAdminOpsRecovery(run)}
    />
  );
}
```

Dry-run fixtures expose only labels to the browser. The source resolves stored
contexts server-side and returns `LifecycleDryRunEvidence`, which contains safe
signal identity, boolean condition evidence, declared actions, suppression, and
Problem codes rather than arbitrary context values. Pasted contexts remain
disabled unless a server-side `parsePastedContext` schema validator is supplied.
Run history distinguishes completed, failed action, not matched, cooldown
suppression, and other suppressed outcomes. Recovery buttons appear only when
an `admin-ops` recovery action explicitly declares retry or replay safe.

## Tenant 360 workspace

`TenantBusinessWorkspace` renders the React-independent snapshot from
`@croco/admin-core`. Source cards fail independently and distinguish loading,
empty, stale, permission-denied, unavailable, and domain Problem states. The
controlled tabs, refresh controls, landmarks, summary links, and action launcher
remain host-composable.

```tsx
import { loadTenantWorkspace } from "@croco/admin-core";
import { TenantBusinessWorkspace } from "@croco/admin-react";

const state = await loadTenantWorkspace({
  tenantId: "tenant-1",
  sources: [identitySource, billingSource, usageSource, engagementExtensionSource],
  grantedPermissions: ["tenant:read", "billing:read", "usage:read"],
  actions: [refreshEntitlementsAction],
});

export function Tenant360() {
  return (
    <TenantBusinessWorkspace
      state={state}
      onRefreshSource={(sourceId) => refreshSource(sourceId)}
      onAction={(request) => confirmAction(request)}
      renderExtension={(extension) =>
        extension.contractId === "engagement/customer-360" ? (
          <EngagementCustomer360 state={extension.state} />
        ) : null
      }
    />
  );
}
```

Write controls appear only from an explicit `AdminAction` plus an evaluated
permission result. Action requests preserve required reason/idempotency input,
possible Problems, and recovery state. Provider state marked read-only is never
presented as editable.

## Outbound webhook reliability

`WebhookReliabilityConsole` renders `WebhookOperationsState` from `@croco/admin-core`. It distinguishes
loading, empty, permission-denied, store/transport Problem, one-time secret creation, and ready
states. Ready views separate endpoints, logical events, endpoint deliveries, and partial attempt
history, including response status, duration, retry classification, next retry, correlation id, and
redacted response excerpts.

Replay controls are rendered from core-derived action eligibility and remain disabled for pending,
retrying, or accepted deliveries. Pausing explicitly says that already accepted work is not canceled.
Secret rotation shows active/previous version and grace expiry without rendering secret values in
tables or diagnostics.

```tsx
import { WebhookReliabilityConsole } from "@croco/admin-react";

export function WebhookOperations() {
  return (
    <WebhookReliabilityConsole
      state={state}
      filter={{ tenantId: state.tenantId, states: ["dead", "acceptance-unknown"] }}
      onAction={(action) => openAuditedConfirmation(action)}
    />
  );
}
```

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

```tsx
import {
  AdminDataTable,
  createAdminDataTableListResultFromOffsetPage,
  createAdminDataTableState,
} from "@croco/admin-react";

const usersResource = {
  id: "users",
  label: "Users",
  rowId: (user: { id: string }) => user.id,
  requiredPermissions: ["users:read"],
  columns: [
    { id: "email", header: "Email", field: "email", sortable: true, filterable: true },
    { id: "status", header: "Status", field: "status", sortable: true, filterable: true },
  ],
  list: {
    generatedClient: "admin.users.list",
    queryKey: ["admin", "users"],
  },
};

const tableState = createAdminDataTableState({
  resource: usersResource,
  grantedPermissions: ["users:read"],
  result: createAdminDataTableListResultFromOffsetPage(generatedUsersPage, {
    source: "generated-client",
  }),
});

export function UsersTable() {
  return <AdminDataTable state={tableState} />;
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
- Data tables model resource columns, stable row ids, generated-client list
  metadata, pagination/search adapters, row actions, bulk actions, empty state,
  Problem state, and permission denial as explicit state.

## Admin forms

Generated admin resources can hand their backend input type to
`AdminFormContract<TValues, TResult>` and keep field metadata, submit lifecycle,
Problems, recovery actions, and audit metadata in one contract.

```tsx
import { AdminForm, type AdminFormContract, useAdminForm } from "@croco/admin-react";

type CreateUserInput = {
  readonly email: string;
  readonly role: "owner" | "viewer";
};

const createUserForm: AdminFormContract<CreateUserInput, { readonly id: string }> = {
  id: "admin.users.create",
  title: "Create user",
  intent: "create",
  initialValues: { email: "", role: "viewer" },
  fields: [
    { name: "email", label: "Email", inputType: "email", schemaPath: "CreateUserInput.email" },
    {
      name: "role",
      label: "Role",
      inputType: "select",
      schemaPath: "CreateUserInput.role",
      options: [
        { label: "Owner", value: "owner" },
        { label: "Viewer", value: "viewer" },
      ],
    },
  ],
  requiredPermissions: ["admin:user:write"],
  grantedPermissions: ["admin:user:write"],
  audit: {
    eventName: "admin.user.created",
    subjectType: "tenant",
    subjectId: "tenant-1",
  },
  async submit({ values }) {
    return {
      kind: "success",
      data: await createUser(values),
    };
  },
};

export function CreateUserForm() {
  const form = useAdminForm(createUserForm);

  return <AdminForm state={form.state} onFieldChange={form.setFieldValue} onSubmit={form.submit} />;
}
```

`validation_failed` submit results render field errors beside their fields.
`domain_problem`, `permission_denied`, and `external_failure` render as global
Problems with explicit recovery actions, so custom visual components can reuse
the same state model without losing failure evidence.
