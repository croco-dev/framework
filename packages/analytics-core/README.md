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
