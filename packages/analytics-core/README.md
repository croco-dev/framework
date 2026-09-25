# @croco/analytics-core

Core analytics abstraction for Croco applications.

`@croco/analytics-core` defines `AnalyticsManager`, the framework-level contract for
capturing product events, identifying users, associating users with groups or tenants,
and flushing buffered events at runtime boundaries. Concrete providers, such as PostHog
or custom warehouse integrations, implement this contract while application services
depend on the stable core API.

## Public API

- `AnalyticsManager` - abstract manager for `capture`, `identify`, `group`, and
  `flush` operations.
- `defineProductEvent` and `ProductEventCatalog` - typed declaration, runtime validation,
  deterministic JSON/Markdown manifest, and local capture result.
- `InMemoryProductEventDiagnosticsSink` - bounded process-local failure codes and receipt
  counts. Inject a durable sink when diagnostics must survive a restart.

## Usage

```typescript
import { AnalyticsManager } from "@croco/analytics-core";

class ProductAnalytics extends AnalyticsManager {
  capture(event: string, properties?: Record<string, unknown>): void {
    // Send the event to the provider implementation.
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    // Bind user traits to a provider profile.
  }

  group(groupType: string, groupKey: string, properties?: Record<string, unknown>): void {
    // Bind the user to a tenant, organization, or account group.
  }

  async flush(): Promise<void> {
    // Send or drain any provider-buffered events before shutdown.
  }
}
```

## Runtime boundaries

`flush()` is a no-op by default so existing custom managers remain compatible. Providers
that buffer events should override it and surface provider failures with deterministic
Croco Problems instead of treating a failed drain as success.

## Typed product events

The schema is the source for TypeScript payload types, runtime validation, and the exported
catalog descriptor. Register every supported name and version at bootstrap. The catalog rejects
duplicates, reserved context property names, unknown versions, missing properties, and incorrect
property types before invoking the manager. The legacy `capture(string, properties)` method stays
available.

```typescript typecheck
import {
  AnalyticsManager,
  defineProductEvent,
  ProductEventCatalog,
  productEventManifestJson,
} from "@croco/analytics-core";

const reportCreated = defineProductEvent({
  name: "report.created",
  description: "A report has been committed for a tenant.",
  version: 1,
  subjectKind: "user",
  occurrence: "committed",
  scope: "tenant",
  owner: "reporting",
  sourceLocation: "src/reports/ReportService.ts:42",
  schema: {
    type: "object",
    properties: {
      reportType: { type: "string", enum: ["daily", "monthly"] },
      itemCount: { type: "number" },
    },
  },
  properties: {
    reportType: "Report period",
    itemCount: "Number of items",
  },
});

class LocalAnalytics extends AnalyticsManager {
  readonly events: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  capture(name: string, properties?: Record<string, unknown>): void {
    this.events.push({ name, properties });
  }
  identify(): void {}
  group(): void {}
}

const analytics = new LocalAnalytics();
const catalog = new ProductEventCatalog([reportCreated], analytics);
const result = catalog.captureTyped(
  reportCreated,
  { reportType: "daily", itemCount: 3 },
  {
    appId: "reports-app",
    environment: "production",
    tenantId: "tenant-a",
    subject: { kind: "user", id: "user-a" },
    eventId: globalThis.crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
  },
);
const manifest = productEventManifestJson(catalog);
void result;
void manifest;
```

`accepted` means the local manager accepted the event; it does not prove storage by an external
provider. `invalid` is not sent. `unavailable` means no local transport accepted it. A
`diagnosticsUnavailable: true` result preserves that capture outcome when the diagnostic sink
fails; repair or reconcile the diagnostics separately. Observations are keyed by app, environment,
tenant, event name, and version, and an evicted process-local observation is unobserved. Keep the
source `eventId` and `occurredAt` across delivery retries; give a separate real action a new ID.
Only server-validated subject and scope values belong in context. A tenant-scoped definition
requires `tenantId`; an app-scoped definition rejects it. Payload properties cannot replace
trusted context. The catalog's in-memory diagnostics are not a warehouse or durable receipt ledger.
The base `AnalyticsManager.captureValidatedEnvelope()` forwards the validated envelope fields
through `capture()` for existing custom managers; provider implementations can override the hook
when they need a native envelope mapping.

For a `committed` event, use the existing domain event after-commit boundary. The transaction-bound
`EventPublisher` publishes only after a successful commit; its registered handler then calls
`catalog.captureTyped` with the domain event's original ID and timestamp. A rollback never runs
that handler. For durable delivery, use the existing outbox publisher instead of relying on a
process-local after-commit callback. Check the transaction's after-commit outcome when delivery
failure must be reconciled.

```typescript typecheck
import { DomainEvent, EventPublisher } from "@croco/events-core";
import type { ProductEventCatalog, ProductEventDefinition } from "@croco/analytics-core";

class ReportCreatedDomainEvent extends DomainEvent {
  static eventName = "report.domain-created";
  constructor(
    readonly tenantId: string,
    readonly userId: string,
    readonly reportType: string,
  ) {
    super();
  }
}

function scheduleAfterCommit(publisher: EventPublisher, event: ReportCreatedDomainEvent): void {
  publisher.publishAfterCommit(event);
}

function captureCommittedReport(
  catalog: ProductEventCatalog,
  definition: ProductEventDefinition,
  event: ReportCreatedDomainEvent,
): void {
  catalog.captureTyped(
    definition,
    { reportType: event.reportType },
    {
      appId: "reports-app",
      environment: "production",
      tenantId: event.tenantId,
      subject: { kind: "user", id: event.userId },
      eventId: event.eventId,
      occurredAt: event.timestamp.toISOString(),
    },
  );
}
void scheduleAfterCommit;
void captureCommittedReport;
```

## Verification

```bash
pnpm --filter @croco/analytics-core test
pnpm --filter @croco/analytics-core typecheck
```

## Fact history

`FactHistoryService` records explicitly supplied attribute changes through a
`FactHistoryStore`. `@croco/analytics-drizzle` supplies the PostgreSQL store. The
application retains ownership of its customer repository and verifies subject
identity before invoking the service.

```typescript no-check
import { FactHistoryService } from "@croco/analytics-core";

const facts = new FactHistoryService(
  store,
  [{ id: "verified", version: "1", validate: (value) => typeof value === "boolean" }],
  {
    authorize: (request) => applicationPolicy.requireFactAccess(request),
    mask: (row) => applicationPolicy.maskFact(row),
  },
);

await facts.appendFact({
  scope: { app: "shop", environment: "production", tenantId: "tenant-1" },
  source: "identity-provider",
  sourceEventId: "verification-123",
  sourceFingerprint: canonicalSourceSha256,
  row: {
    subject: { kind: "user", id: "customer-1" },
    definitionId: "verified",
    definitionVersion: "1",
    projectionId: "customer-attributes",
    projectionRowKey: "verified",
    materializationRevision: "1",
    value: true,
    validFrom: "2026-09-25T11:00:00Z",
  },
});

const result = await facts.readFactsAt({
  scope: { app: "shop", environment: "production", tenantId: "tenant-1" },
  subject: { kind: "user", id: "customer-1" },
  definitionId: "verified",
  definitionVersion: "1",
  materializationRevision: "1",
  effectiveAt: "2026-09-25T11:00:00Z",
  knownAt: "2026-09-25T11:30:00Z",
});
```

`effectiveAt` selects the half-open `[validFrom, validTo)` interval. `knownAt`
excludes rows received later, using the service-assigned `recordedAt`. Omitted
`knownAt` is frozen once per query. Missing history returns `unknown`; incompatible
active values return `conflict` unless an explicit correction or configured source
priority resolves them. Storage and authorization errors propagate. The service
never backfills history from a current customer value.

Source receipt identity is `(scope, source, sourceEventId)`. A canonical source
hash detects conflicting reuse of that identity without storing the source
payload. Each receipt may produce multiple subjects and definitions. Projection
identity additionally includes subject kind/id, definition ID, projection ID,
projection row key, and materialization revision; the exported
`factProjectionKey` encodes the tuple without delimiter ambiguity.

`appendFacts` accepts 1–100 rows with one materialization revision as an atomic source batch. The store must fix
its expected projection set per materialization generation and make a replay
idempotent. No chunked ingestion mode is provided. Reads explicitly select both
`definitionVersion` and `materializationRevision`, so recomputed generations are
never combined implicitly. `readHistory` accepts a limit of 1–1000;
`readFactsAt` fails with `history-limit` when reconstruction exceeds 1000 rows.

Manual corrections append rows with `supersedes` and batch correction metadata:
`actor`, `reason`, `expectedRevision`, and `idempotencyKey`. `getRevision` returns
the store's scope-wide revision for compare-and-set; an intervening write in that
scope requires the caller to reread before retrying a correction. Prior rows are
retained as correction provenance until subject deletion.

Both `authorize` and `mask` are required application policies. Authorization runs
for the exact scope, subject, operation, and definition before persistence. A null
`tenantId` identifies the explicit tenantless scope and grants no additional
access. User, tenant, and anonymous subjects remain separate. Masking runs after
conflict evaluation, preserving contradictions even when values are redacted.
The application must authenticate correction actors and restrict fields through
this policy. `deleteSubject` authorizes deletion; the store must remove the
subject's data and persist an access tombstone to prevent replay restoration.
Applications must invalidate their derived caches and apply a finite retention
policy to the source and projections as part of their deletion lifecycle.
