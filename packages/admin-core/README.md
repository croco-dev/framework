# @croco/admin-core

`@croco/admin-core` defines UI-agnostic admin resource and action contracts for
Croco admin surfaces. Admin packages can describe resources, list/detail fields,
permissions, audit evidence, declared Problems, and recovery semantics without
depending on React or a transport adapter.

## Product event catalog

`loadEventCatalog()` and `validateEventCatalogPayload()` use an explicit app or tenant scope with
an app ID and environment. Tenant scope requires a tenant ID and `analytics:read` or
`analytics:validate`; app scope omits the tenant ID and requires the separate
`analytics:app:read` or `analytics:app:validate` permission. The host must authenticate the
principal and resolve permissions for the requested scope on the server before calling either
operation. Caller-provided principal IDs and permission strings are not authentication evidence.
The load response contains serializable entries; the separate asynchronous validation call belongs
on a trusted server. `createInProcessEventCatalogSource()` adapts an `@croco/analytics-core`
`ProductEventCatalog` for a trusted in-process host; the adapter itself does not authenticate
principals or resolve permissions.

The load result distinguishes an unobserved event from an observed event with zero receipts.
The in-process adapter validates with that same registered schema. `validateEventCatalogPayload`
returns `delivery: "not-sent"` for valid, invalid, and missing event versions; test payloads
are never captured or stored by these helpers. Diagnostics expose bounded codes and receipt
timestamps, not rejected payloads. Hosts that need durable diagnostics supply a durable sink to
the analytics catalog. A source response for another scope or an inconsistent observation is
rejected instead of being displayed as current tenant data.

## Tenant 360 sources

`TenantBusinessSource<TState>` is a structural, React-independent boundary for
cross-domain tenant workspaces. A host installs only the sources it has and
`loadTenantWorkspace()` preserves each source result independently as `ready`,
`empty`, `stale`, `permission-denied`, `unavailable`, or domain `problem`.

```ts
import {
  createInMemoryTenantBusinessSource,
  loadTenantWorkspace,
  type TenantUsageSummary,
} from "@croco/admin-core";

const usage = createInMemoryTenantBusinessSource<TenantUsageSummary>({
  id: "usage",
  label: "Usage",
  section: "usage",
  requiredPermissions: ["usage:read"],
  result: {
    kind: "ready",
    loadedAt: new Date(),
    state: {
      kind: "usage",
      meters: [],
      warningCount: 0,
      overLimitCount: 0,
    },
  },
});

const snapshot = await loadTenantWorkspace({
  tenantId: "tenant-1",
  sources: [usage],
  grantedPermissions: ["usage:read"],
});
```

Actions reuse `AdminAction`; availability is derived from its permission
requirements before React sees it. Sensitive fields use
`resolveTenantWorkspaceField()` so hosts provide an explicit visible, masked, or
denied result instead of relying on presentation code to guess.

## Outbound webhook operations

Webhook operations contracts keep endpoint, logical event, delivery, and attempt evidence separate.
Endpoint rows expose only a masked URL and secret version metadata; secret material, signatures,
payloads, and raw headers are not part of the ready-state contract. A newly created or rotated
secret uses the explicit `secret-created` state for one-time presentation.

`createWebhookDeliveryAction()` mirrors the core replay contract: only `delivered`, `dead`,
`canceled`, and `acceptance-unknown` deliveries on an active endpoint can expose replay.
`assertWebhookOperationsActionRequest()` requires actor, reason, and idempotency evidence for every
write. `redactWebhookOperationsText()` is the final display boundary for hostile Problem or response
excerpts.

```ts
import { createWebhookDeliveryAction, executeWebhookOperationsAction } from "@croco/admin-core";

const replay = createWebhookDeliveryAction(delivery, endpoint, ["webhooks:replay"]);
if (replay.allowed) {
  await executeWebhookOperationsAction({
    action: replay,
    expectedTenantId: endpoint.tenantId,
    grantedPermissions: ["webhooks:replay"],
    request: {
      action: replay.kind,
      actorId: operator.id,
      idempotencyKey: commandId,
      reason,
      targetId: replay.targetId,
      tenantId: endpoint.tenantId,
    },
    executor: webhookMutationExecutor,
  });
}
```

`WebhookOperationsMutationExecutor` is the server-side mutation boundary. Implementations must apply
the idempotency claim, mutation, and audit append atomically after the helper has bound tenant,
target, action eligibility, and permission evidence.

## Engagement operations

Engagement operations contracts provide Customer 360 communication state, message descriptors and previews,
audience estimates, campaign lifecycle controls, delivery logs, suppressions, and endpoint reactivation.
All operations contracts remain React-independent and enforce permission and audit evidence:

- `Customer360CommunicationState`: tenant-scoped recipient communication state including masked email addresses (unmasked only with `engagement:pii:read`), push tokens (strictly masked via `maskPushToken` and never displayed in full under any permission), active/invalidated endpoints, preferences, suppressions, recent dispatches, delivery events, and audience memberships.
- `assertCampaignRunValid`: enforces that a campaign cannot start before a complete immutable snapshot exists with positive member count, plus actor, reason, and idempotency key.
- `assertRetryDispatchValid`: enforces that retry/replay controls appear only for explicitly safe, retryable outcomes (`status === 'failed' && retryable === true`).
- `assertCreateSuppressionValid`, `assertRemoveSuppressionValid`, `assertEndpointReactivateValid`: enforce required actor, reason, and idempotency audit evidence.
- `assertTestSendValid`: enforces audit evidence and destination validation for test sends.
- `createEngagementTenantExtension`: generates a `TenantWorkspaceExtension` mounting Customer 360 into `TenantBusinessWorkspace`.

## Resource contracts

```ts
import { assertAdminResourceValid, defineAdminResource } from "@croco/admin-core";

const userResource = defineAdminResource({
  kind: "user",
  label: "User",
  scope: "tenant",
  source: "croco",
  identity: {
    idField: "id",
    labelField: "email",
    tenantField: "tenantId",
    subjectType: "user",
  },
  fields: [
    { id: "id", label: "ID", valueType: "string" },
    { id: "email", label: "Email", valueType: "string", filterable: true },
    { id: "status", label: "Status", valueType: "status", filterable: true },
  ],
  list: {
    fields: ["email", "status"],
    filters: ["status"],
  },
  detail: {
    fields: ["id", "email", "status"],
  },
  actions: [
    {
      id: "disable",
      label: "Disable",
      kind: "disable",
      target: "record",
      mutability: "write",
      permissions: [{ permissions: ["users:disable"], scope: "tenant" }],
      audit: {
        actor: "required",
        eventName: "admin.user.disabled",
        reason: "required",
        subjectIdField: "id",
        subjectType: "user",
      },
      problems: [{ code: "auth/user-not-found", status: 404 }],
    },
  ],
});

assertAdminResourceValid(userResource);
```

## Validation

`validateAdminResource()` returns typed diagnostics for invalid definitions.
`assertAdminResourceValid()` throws `AdminResourceValidationProblem`, preserving
all diagnostics in RFC 7807 extensions so build-time or codegen checks can fail
without guessing at runtime.
