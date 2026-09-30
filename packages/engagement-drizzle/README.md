# @croco/engagement-drizzle

PostgreSQL/Drizzle persistence for the provider-neutral contracts in `@croco/engagement-core`.
It stores contact endpoints, preferences, suppressions, logical dispatch evidence, normalized
delivery events, and immutable campaign audience snapshots. Application customer/profile records
remain owned by the application's recipient directory.

## Policy order

`EngagementService` applies policy in this order:

1. required static/system rules from `@croco/notifications-core`;
2. active endpoint or recipient suppressions;
3. stored recipient preferences;
4. stored tenant defaults;
5. explicitly configured topic or global defaults.

Static rules are a veto. If no stored decision or explicit default exists, the durable policy
evaluator denies the send. This prevents marketing-like topics from silently inheriting an allow
default. Suppressed and unavailable dispatches are recorded as outcomes, not provider failures.

## Setup

```ts
import {
  EngagementService,
  StoreBackedRecipientDirectory,
  StoredEngagementPolicyEvaluator,
} from "@croco/engagement-core";
import { DrizzleEngagementStore, createEngagementSchema } from "@croco/engagement-drizzle";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";

await createEngagementSchema(db);

const transactions = new TxManager(createDrizzleTxAdapter(db));
const engagementStore = new DrizzleEngagementStore(db, transactions);
const directory = new StoreBackedRecipientDirectory(
  customerDirectory,
  engagementStore,
  pushTokenResolver,
);
const policy = new StoredEngagementPolicyEvaluator(engagementStore, engagementStore, {
  topicDefaults: { "system.receipt": "allow" },
});
const engagement = new EngagementService(
  directory,
  renderer,
  notifications,
  policy,
  engagementStore,
);
```

Campaign broadcasts use `DrizzleCampaignStore` with the same database and transaction manager.
Snapshots are assembled in contiguous chunks while in `building`, then atomically transition to
`complete` or `failed`. Completed membership is immutable. Member outcomes keep the first terminal
result while allowing a failed attempt to be replaced by a later successful or suppressed result.
Every campaign row carries the non-null encoded scope key, so global and tenant-owned snapshots can
reuse identifiers without crossing scope boundaries.

`PushTokenResolver` is responsible for resolving secret references at send time. Never store a raw
push token in `tokenReference`, Problems, logs, telemetry, fixtures, or administrative output.
Email addresses and endpoint identifiers are internal store values. Administrative projections must
apply the application's existing PII permission and masking contracts; this package does not expose
an administrative projection.

## Delivery events

Provider packages verify webhooks and map them to normalized engagement events. Pass only allowlisted
provider category/code evidence to `EngagementDeliveryEventProcessor`. Evidence keys are validated at
runtime, and values must be bounded opaque identifiers; response bodies and arbitrary fields are
rejected before persistence. Hard bounces, complaints, unsubscribes, and invalid push tokens invalidate
the exact endpoint version used by the dispatch. A stale event cannot invalidate a renewed endpoint,
and an ordinary endpoint upsert cannot reactivate a terminally invalid endpoint.

All public store methods require tenant scope for recipient-owned data. History is ordered by
`updatedAt` and durable dispatch ID, so pagination remains deterministic when timestamps tie.

## Contact policy persistence

Use `DrizzleContactPolicyStore(db)` as the `ContactPolicy` store. The adapter creates a bucket
for each app/environment/tenant/subject and locks that row within a PostgreSQL transaction before
reading the ledger, evaluating quota, and writing reservations. Two application connections therefore
share the same budget, including when the ledger is initially empty. Callback failures roll back all
writes. Reserved, committed, released, and unknown states survive process restarts; expiration never
automatically returns unknown budget. Ledger fields contain opaque recipient/group identifiers and
payload fingerprints, without contact addresses or provider tokens. Optional campaign IDs preserve
which campaign consumed a budget. Explicit reconciliation retains the verified evidence reference,
actor, reason, and acceptance outcome across restarts; never place raw provider responses in evidence.

`DrizzleContactPolicyAdminStore(db)` implements the administrative settings contract structurally.
Settings, revision comparisons, edit idempotency, and actor/reason audit apply to the whole
app/environment/tenant scope. The authorized subject selects suppression history only. `loadPolicy(scope)`
loads the current settings without reading recipient history. Wire it into the engagement gate's
`resolvePolicy` callback to construct `ContactPolicy` with the shared ledger, current config, and server
registered topics before each send. Reject missing settings explicitly. The administration layer must
authorize tenant-wide writes and validate edits against the server's registered bounds and topic kinds.

Recent suppression history reads up to 100 scoped contact-policy outcomes from the existing dispatch
store. `historyComplete` is false when further matching records exist. This history describes sends
through the installed engagement gate; external sends and low-level bypasses are outside its coverage.

`createEngagementSchema` adds contact-policy buckets, reservations, settings, and edit audit tables
idempotently. For rollback, stop contact-policy writers before removing these four tables; removing
them discards deduplication and budget evidence. `dropEngagementSchema` removes all engagement tables
and is intended for disposable test databases, not a production feature rollback. Preserve unknown
reservations until provider acceptance is reconciled.
