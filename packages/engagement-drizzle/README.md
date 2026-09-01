# @croco/engagement-drizzle

PostgreSQL/Drizzle persistence for the provider-neutral contracts in `@croco/engagement-core`.
It stores contact endpoints, preferences, suppressions, logical dispatch evidence, and normalized
delivery events. Application customer/profile records remain owned by the application's recipient
directory.

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
