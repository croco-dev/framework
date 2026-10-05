# @croco/admin-ops

`@croco/admin-ops` provides operations timeline and retry console contracts used
by admin surfaces to inspect audit logs, domain events, task failures, workflow
runs, lifecycle actions, and failed work recovery in one operations package.

The package intentionally uses structural source types for timeline normalization
and optional source adapters for retry recovery. Apps can normalize audit, events,
tasks, workflows, or lifecycle records without forcing every source package to be
installed in every admin app.

## Timeline model

```ts
import {
  createOperationsTimeline,
  normalizeAuditLogEntry,
  normalizeDomainEvent,
  normalizeTaskFailureExecution,
} from "@croco/admin-ops";

const timeline = createOperationsTimeline(
  [
    normalizeAuditLogEntry(auditEntry),
    normalizeDomainEvent(domainEvent),
    normalizeTaskFailureExecution(taskExecution),
  ],
  {
    tenantId: "tenant-1",
    entity: { type: "order", id: "order-1" },
    order: "desc",
  },
);
```

Every normalized event preserves source-specific evidence under its typed
`extension` field while projecting common fields such as `tenantId`, timestamp,
severity, correlation id, Problem metadata, retry metadata, and recovery action.

## Retry Console

`@croco/admin-ops` models failed task, workflow, batch, and lifecycle work as `RetryConsoleItem` records. Each item preserves source-specific identifiers, Problem metadata, attempts, timestamps, correlation ids, and explicit recovery actions.

```typescript
import { createRetryConsole, createTaskRetryConsoleSource } from "@croco/admin-ops";

const retryConsole = createRetryConsole([createTaskRetryConsoleSource(executionManager)]);

const failedWork = await retryConsole.list({ states: ["retryable"] });

await retryConsole.recover({
  itemId: failedWork[0].id,
  actionId: "retry",
  permission: {
    granted: true,
    descriptor: failedWork[0].recoveryActions[0].permission,
  },
  audit: {
    actorId: "ops-user-1",
    reason: "Retry after upstream outage recovered",
    idempotencyKey: "ops-retry-123",
  },
});
```

Recovery requests require permission and audit descriptors. Execution retries require an audit log sink so the operator action is not silently lost.

The console deduplicates only concurrent recovery calls with the same item, action, and audit idempotency key. It removes both successful and failed results immediately after settlement, so providers remain responsible for durable idempotency and cross-process replay behavior.

## Outbound webhook adapters

`operationsTimelineEventFromWebhookDelivery()` and `retryConsoleItemFromWebhookDelivery()` accept a
structural failed-delivery evidence contract, so `admin-ops` does not depend on a webhook storage
implementation. Both adapters preserve the tenant, logical event, endpoint delivery, correlation,
Problem, attempts, and next-retry evidence without copying payloads, headers, signatures, or secret
material.

The retry console combines replay eligibility supplied by the core webhook contract with its own
terminal-status and active-endpoint checks. It never infers that a delivery is safe to replay merely
because it failed; non-eligible and acceptance-unknown deliveries remain inspect-only until the host
supplies consistent safe-replay evidence.

## React Primitives

The package exports small React primitives for building an admin retry console:

- `RetryConsoleFailedWorkList`
- `RetryConsoleDetailPanel`
- `RetryConsoleRetryButton`
- `RetryConsoleNonRetryableExplanation`
- `RetryConsoleAuditConfirmation`

These primitives render from `RetryConsoleItem` contracts and leave authorization, data loading, and styling to the host admin console.

## Customer Explorer adapters

`PostgresTimelineSource` reads an application's existing normalized table through a validated `ExplorerSqlTimelineMapping`. Scope, subject and time predicates are parameterized before the per-subject `LIMIT`; keyset cursors bind the source, scope, subject and window, preserve PostgreSQL timestamp precision and order event keys with the `C` collation. Configure a source status callback that checks provider authorization and reports real coverage. A complete empty source and an unavailable source are different results.

`EngagementCustomerExplorerSource` wraps the existing tenant/recipient dispatch store's `listByRecipient` and `getDispatch`, reusing the engagement normalizer. Pin its app/environment/tenant scope because the underlying store is tenant-aware. Queued and accepted delivery evidence must retain their original meanings; this adapter does not infer a click or server payment from message delivery. A page can have no in-window events while still carrying a continuation cursor.

`OperationsCustomerExplorerSource` wraps an existing normalized `OperationsTimelineSourceAdapter` and checks tenant/customer boundaries. Its upstream `collect` contract is unbounded, so use the SQL source for large histories. Original source and event ID form a composite reference; unrelated sources are never merged by ID alone.

`PostgresCustomerExplorerRepository` accepts a structural PostgreSQL pool interface, without choosing a driver. Apply the packaged `dist/migrations/0001_customer_explorer.up.sql` through your existing deployment migration owner. The repository performs no boot DDL. It stores only samples, notes, revision/actor audit records and snapshot content digests, not source logs. Note updates and their audits commit atomically. Deleted notes retain a content-free revision tombstone until sample deletion or expiry purge, so old writers cannot recreate an ID and overwrite new evidence; stale revisions fail with `customer-explorer/revision-conflict`.

Expiry prevents reads; call `purgeExpired(scope, now)` through a privileged retention job to delete expired sample data and cascading notes/audits. Explicit scoped sample deletion has the same cascade. Snapshot digests contain no source payload or membership list and remain after deletion to reject later content changes under the same snapshot ID. The schema is additive; rolling it back discards saved observations and requires the deployment owner's explicit data-retention decision.

[Standalone PostgreSQL example](../../examples/customer-explorer/README.md) demonstrates source mapping, authorization, migration setup and durable note rereads. These adapters are source-verified implementations; local synthetic tests do not establish provider certification or production identity policy.
