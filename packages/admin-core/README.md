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

## Policy release authorization

`PolicyReleaseAccess` is resolved by the server from its authenticated identity. Its scope
includes an explicit tenant ID or `null` for a separately granted app-wide scope. Omitting a
tenant never grants app-wide access. `assertPolicyReleaseAccess` requires an exact app,
environment, and tenant match and the requested read, write, review, or publish permission.
Never accept the access object or actor identity from browser request JSON.

`PolicyReleaseOperations` wraps the same `PolicyReleaseService` used by standalone callers.
Its bounded `read({ policyId, scope }, access)` reads one latest revision. `edit` accepts one
registered descriptor ID (`field`) and its value; `review` and `publish` delegate the exact
expected revision to the service. Every mutation requires `reason`, `expectedRevision`, and
`idempotencyKey`; the actor comes from server access. `publish` accepts the review hash and
an optional canonical UTC `effectiveAt` for scheduling. A provider failure propagates.

Snapshots omit sensitive field values and conservatively redact semantic changes when a
registration contains a sensitive field. Validation exposes code, path, and severity without raw input. Field snapshots retain numeric
bounds and select options. Publication and schedule receipts are read from the persisted command
receipt, including after reload. The default
impact snapshot reports the revision state as fact and missing outcome data explicitly;
applications may supply separately sourced estimates to the console.

## Contact policy operations

`ContactPolicyOperations` provides standalone server operations for the optional
engagement contact policy gate. `load`, `save`, and `dryRun` require an explicit
`{ scope: { app, environment, tenantId }, subject }` target. The server-owned
`authorize` callback resolves the authenticated actor and `contact-policy.read`
or `contact-policy.write` permissions for that exact target. Write permission must authorize tenant-wide policy changes; client permissions
are never authorization evidence.

Register editable rule limit bounds, optional quiet hours, and topic priority
bounds with `ContactPolicyAdminRegistration`. Edits cannot change topic kinds,
message registrations, rule targeting, or reservation TTL. Topic exception
registration remains in application code. `createPolicy(snapshot)` constructs
the same `ContactPolicy` used by the send gate; dry-run calls its non-consuming
`evaluate` method and never reserves budget.

Policy settings and write idempotency keys belong to app/environment/tenant.
The subject selects dry-run and history only; it does not partition configuration.
Supply a `ContactPolicyAdminStore` with atomic revision comparison, idempotency
replay/conflict detection, and audit persistence. `save` passes the original edit,
server actor, reason, expected revision and key into that transaction. Persisted
configuration revisions become policy versions for subsequent sends. History
must be scoped to the authorized subject and contain only logical send/campaign
IDs and decision metadata; it must not contain contact addresses or tokens.
`historyComplete: false` signals partial evidence rather than a complete count.

Install the send gate with `resolvePolicy(scope)` when operators can edit the
policy. Resolve the persisted configuration for that app/environment/tenant and
construct `ContactPolicy` with its config/topics and the shared durable budget
store. Use the same factory for `ContactPolicyOperations.createPolicy`. The gate
resolves configuration immediately before each new channel reservation; prior
reservations retain their recorded policy version. A static gate policy is
appropriate only when configuration is supplied exclusively in code.

Persisted settings must match the deployed code registration. Call
`assertContactPolicyRegistration(snapshot, registration)` before constructing a send
policy from stored settings; `ContactPolicyOperations` applies this guard to reads,
dry-runs, and saves. The guard preserves permitted limit, priority, and quiet-hour
overrides, and rejects changed registration versions, rule topology or timing,
reservation TTL, topic kinds, message memberships, or overrides outside current
bounds with `admin-core/contact-policy-invalid`. A deployment that changes these
contracts requires an explicit settings migration or reinitialization. Do not
reuse the old snapshot or silently substitute defaults after validation fails.

## Experiment operations

`ExperimentOperations` is the server boundary for the registered experiment runtime. Construct `ExperimentAdminAccess` from authentication with an explicit app, environment, tenant (`null` means an explicitly authorized application scope), actor, and permissions. Tenant omission is denied. Read access is required alongside preview, operate, or configure permissions.

The boundary exposes only public definition fields and server-owned sample labels. `preview(target, sampleId, access)` resolves the subject and context on the server, calls the runtime's non-persistent preview, and removes provider metadata. It never accepts client-selected subjects or handlers.

`command` supplies start/pause/stop with a server-resolved actor, reason, idempotency key, and expected state version (`expectedRevision`, initially zero). `configure` creates a new immutable revision; it retains the server registration's identity, salt, allocator, and private handlers. Operators may change the unit, login policy, registered eligibility rule, allocation/weights, hypothesis, observation plan, and UTC period. The runtime validates variant identities and values against the source registration. Existing assignments keep their original revision.

See `examples/experiment-runtime` for a credential-free Console and actual server treatment flow.

## Journey operations

`JourneyOperations` is a server boundary for listing redacted episode evidence,
previewing registered sample subjects, and pause/resume/stop commands. Supply an
`authenticate()` function that derives scope, actor and permissions from the server
session. Request bodies supply no authority: each method verifies tenant, app and
environment plus `journey.read`, `journey.preview` or `journey.operate`.

Commands require an audit reason, idempotency key and expected revision. The
adapter calls `JourneyEngine.command`; the engine persists audit and enforces
revision/idempotency semantics. Errors propagate, including revision conflicts.
The dry-run adapter resolves a registered sample in the authenticated scope and
uses an isolated, non-dispatching preview. Returned views exclude raw subjects,
business objects, action parameters and audit payloads; receipt reason codes are
allowlisted. `safeResume` is false when admitted or indeterminate actions remain.

## Customer Explorer

Timestamp inputs require an explicit ISO timezone and support up to six fractional second digits. Finer precision is rejected rather than rounded; occurrence order, anchor phases and observation windows preserve microseconds.

`CustomerExplorerService` owns deterministic SHA-256 sampling, scoped authorization, per-subject timeline merging, API property minimization, notes and typed observation drafts. Bind `ExplorerAuthorization` to an authenticated server actor; callers cannot supply a trusted actor or permission grant. Scope always includes `appId`, `environment` and `tenantId`; an omitted tenant is invalid.

`SampleQuery` pins the seed, population snapshot, definition revision, anchor window and sample counts (defaults: 10 achievers and 5 prior-step comparisons; maximum 100 of each). These are exploratory UX limits, not a statistical representation claim. Supply an immutable, authorized `ExplorerPopulation` from your existing source snapshot. Anonymous identities must remain separate unless the application supplies authorized identity-link evidence before constructing that population.

A `TimelineSource` reads one subject and one bounded window at a time. Pages default to 50 rows per source and accept at most 200. Events are ordered by occurrence time, source and stable event ID; equal times do not imply causality. Source denied, failed, delayed and partial statuses remain visible even when no records can be displayed. Property names require a server allowlist; contact/credential keys are dropped, email/phone text is masked and object references are omitted. Hosts must use pseudonymous subject/event identifiers and safe categorical event kinds; automatic text masking is not a general PII classifier.

Notes distinguish `fact` and `hypothesis`, preserve server actor/revision audit records, and use repository compare-and-set for edits. New evidence references must exist inside the selected subject's window. Existing references survive source deletion as `unavailable`; source payloads are never cached in a note. Samples and notes have explicit expiry bounded by service policy. `deleteSample` removes its notes and audit records through the selected repository; use its explicit retention purge for expired storage.

`exportDraft` requires a separate export permission and returns an `ExplorerQueryDraft` containing typed source/kind/anchor conditions, the population snapshot and definition revision. It does not export raw records. Integrations without Cohort Builder can download this definition directly. The React workspace uses the same service callbacks. See [the standalone PostgreSQL example](../../examples/customer-explorer/README.md).
