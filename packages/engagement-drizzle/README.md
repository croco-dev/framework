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
  EngagementDeliveryEventProcessor,
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
const directory = new StoreBackedRecipientDirectory(customerDirectory, engagementStore);
const policy = new StoredEngagementPolicyEvaluator(engagementStore, engagementStore, {
  topicDefaults: { "system.receipt": "allow" },
});
const engagement = new EngagementService(
  directory,
  renderer,
  notifications,
  policy,
  engagementStore,
  () => new Date(),
  new EngagementDeliveryEventProcessor(engagementStore),
);
```

Campaign broadcasts use `DrizzleCampaignStore` with the same database and transaction manager.
Snapshots are assembled in contiguous chunks while in `building`, then atomically transition to
`complete` or `failed`. Completed membership is immutable. Member outcomes keep the first terminal
result while allowing a failed attempt to be replaced by a later successful or suppressed result.
Every campaign row carries the non-null encoded scope key, so global and tenant-owned snapshots can
reuse identifiers without crossing scope boundaries.

`StoreBackedRecipientDirectory` preserves opaque `tokenReference` values in dispatch payloads.
Configure `FcmProvider` with `resolveToken` to read tokens from an application-owned vault inside
the provider, after task persistence. The directory no longer accepts a `PushTokenResolver` argument.
Never store a raw push token in `tokenReference`, Problems, logs, telemetry, fixtures, or administrative output.
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

With `EngagementService` and its delivery-event processor using this store, persisted dispatches
retain enough evidence to reconcile acceptance and terminal token-invalid events on replay. If the
event store fails after the dispatch is saved, retry the same semantic key after recovery; replay
completes the missing events and endpoint invalidation without another provider send. Concurrent
endpoint refreshes preserve the greatest `lastSeenAt` value.

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

## Reminder persistence

Use `DrizzleReminderStore(db)` with `ReminderService`. It locks a dedicated
app/environment/tenant/subject bucket before reading reminders, occurrences and mutation audit,
including the first transaction for an empty subject. Competing database connections therefore
serialize creation, revision checks and occurrence claims. Callback and database failures roll back
the entire transaction. The store rejects reminder and audit writes outside the locked subject and
occurrences whose reminder is absent from that subject.

Reminders and occurrences use separate typed tables. Mutation results retain their original revision
for idempotent replay; persisted timestamps are returned as `Date` values. Reconciliation audit keeps
the actor, reason, occurrence ID, evidence reference and acceptance outcome. Store opaque evidence
references rather than provider responses or credentials. Unknown occurrences remain available after
a process restart for explicit reconciliation.

Run `createEngagementSchema` in your migration process to add the four reminder tables idempotently.
Existing engagement data is preserved. For feature rollback, stop reminder writers before removing
`engagement_reminder_mutations`, `engagement_reminder_occurrences`, `engagement_reminders`, then
`engagement_reminder_buckets`. Removing them discards replay and acceptance evidence; reconcile
unknown outcomes and retain the required audit before removal. `dropEngagementSchema` removes all
engagement tables and is intended for disposable databases.
