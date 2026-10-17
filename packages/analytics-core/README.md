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

## Confirmed growth analysis

`AnalysisPlan`, `AnalysisProposal`, and `AnalysisAnswer` are browser-safe view contracts. The server-only `@croco/analytics-core/runtime` exports `GrowthAnalysisService`, which selects trusted registered choices through an app-injected native model function and executes confirmed plans through the existing `MetricReadService`. Matching verified reports supply actual facts without another query.

The app provides authenticated scope binding, PII rejection/masking, bounded registrations, model limits, aggregate-field projection, and idempotent usage receipts. The model sees definition metadata and choices, never raw customer rows; it can only return existing choice IDs. Confirmation and current authorization are required before reading results. See [the standalone example](../../examples/growth-analysis/README.md) for local reports, the native SDK HTTP fixture, cancellation, unavailable states, and settlement recovery limits.

`ProposeAnalysisPlan` implementations must honor the supplied `AbortSignal` and settle promptly after cancellation or timeout. The service retains the concurrency slot until that promise settles. A provider that ignores cancellation and never settles keeps its slot occupied; correct or replace that provider before accepting more inference work. A deadline does not release a slot while its provider work remains unresolved.

## Acquisition observations and attribution

Import the standalone surface from `@croco/analytics-core/acquisition`. `parseAcquisitionContext`
and `resolveAttribution` are pure functions; `AcquisitionService` supplies authorized recording,
explicit login linking, immutable audited definitions, bounded comparison/export references, deletion
and retention over an `AcquisitionStore`. See [the runnable first-party example](../../examples/acquisition).

```typescript typecheck
import { parseAcquisitionContext } from "@croco/analytics-core/acquisition";

const urls = {
  origin: "https://shop.example",
  destinations: { home: "/", pricing: "/pricing" },
  campaigns: { utm_source: ["newsletter"] },
  referrerOrigins: ["https://search.example"],
};
const context = parseAcquisitionContext(
  {
    url: "https://shop.example/?utm_source=newsletter&token=discarded",
    referrerAvailable: false,
  },
  urls,
);
// { landingRef: 'home', campaign: { utm_source: 'newsletter' }, referrer: { status: 'unavailable' } }
```

Only registered landing paths, campaign codes and referrer origins survive. Campaign values undergo
NFKC normalization, trimming and lowercasing before exact allowlist matching. Duplicate campaign keys
are ignored. Arbitrary paths, credentials, fragments, unknown query keys and raw referrer paths never
enter persisted context or public diagnostics. `validateAcquisitionContext` repeats validation on the
server and discards extra fields; client UTM values are observations and grant no permission or benefit.
`resolveAcquisitionDestination` accepts a registered reference, never a caller-provided URL.

First-touch and last-observed-touch v1 include both endpoints of
`[conversion.occurredAt - windowMs, conversion.occurredAt]`, exclude future and expired rows, and use
ascending stable IDs to resolve equal timestamps. A campaign/referrer observation receives credit 1;
unknown/direct receives credit 0 and `unattributed`, while still retaining the selected touchpoint.
Last-observed includes subsequent direct/unattributed visits. No last-non-direct fallback is implicit.
Missing UTM or referrer never establishes organic uplift. Source referrer `absent` differs from
`unavailable`. Results conservatively report partial retained coverage, even if an individual row
claims a complete collection interval; first retained touch is never a lifetime-first claim.

Scopes explicitly require app, environment and tenantId (`null` is one untenanted scope, never all
tenants). The application-supplied policy is mandatory for record, link, read, export, define, delete
and purge; policy exceptions fail the operation. The configured actor is server-owned. Authentication,
consent and anonymous-session ownership must be established by this policy, never by campaign values.
`linkKnownSubject` records actor/provenance/time and a snapshot of the anonymous touchpoint IDs accepted
at login. It preserves each row's original identity and never includes later anonymous visits. A session
cannot be remapped to another subject; logout/principal changes must rotate its opaque anonymous ref.

`define` accepts consecutive revisions with actor/reason codes and an idempotency key. Different
payloads sharing a receipt or revision conflict. Reports identify their exact conversion and immutable
definition references. `compare` reads at most 1,000 rows and 10 definitions; overflow raises a stable
Problem rather than attributing truncated history. Referral claims and self-reported codes are optional,
separate rows; conflicting responses stay visible and neither changes the observed channel nor increases
the distinct conversion count. A comparison contains one distinct conversion across all model views.

`policy.mask` receives cloned rows for authorized output, after calculation. It must preserve stable
row IDs referenced by results and redact identifying/source fields according to application policy.
Store failures propagate and never become normal unattributed results. Deletion atomically removes
subject and explicitly linked anonymous rows, mapping receipts and affected report references; opaque
identity tombstones reject stale retries. Expired rows cannot be compared; `purgeExpired` physically
removes them, prunes link references and clears derived report references. Applications schedule purges
and define metadata/tombstone retention separately; a new anonymous session must never reuse a deleted ID.

Timestamps use canonical UTC ISO strings with milliseconds (`Date.toISOString()`). Export report IDs
bind the conversion, definition versions and exact retained evidence references; new or expired evidence
requires a new report ID instead of silently changing a prior receipt. Differences between referral claims
and self-reported answers are independent declarations. Conflict indicates multiple values within the same
source kind, rather than disagreement between those two kinds.

## Reviewed text enrichment

The server-only `@croco/analytics-core/enrichment` entry exports `defineClassification` and
`EnrichmentService` (`enqueueBatch`, `classify`, `review`, `exportLabels`, `retry`, `settle`, `purge`).
An exact normalized dictionary precedes the optional injected `ClassifyText` function; otherwise
classification is explicitly unknown. All candidates require human review before export.

Supply an `EnrichmentStore`, current principal/authorization revision, action authorization,
source availability, mandatory PII block/mask policy and an idempotent usage/event receipt sink.
Budgets and concurrency are bounded per run. Candidates, human overrides, raw/result retention,
and operational receipts are separate. A model response is persisted before sink delivery, so
repeating settlement does not repeat inference. Unknown acceptance requires explicit retry approval.

See [the independent example](../../examples/enrichment-review/README.md) for native SDK mapping,
PostgreSQL migration/CAS, batch checkpoints, review UI, budget assumptions and recovery limitations.
