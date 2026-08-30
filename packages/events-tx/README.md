# @croco/events-tx

Transactional outbox/inbox contracts for Croco domain events.

This package connects `@croco/events-core` with `@croco/tx-core` so application writes and outbox appends can happen in the same transaction, then a relay can publish visible messages with deterministic retry, poison, and dead-letter state.

## Install

```bash
pnpm add @croco/events-tx @croco/events-core @croco/tx-core
```

Use `drizzle-orm` when using `DrizzleTransactionalEventStore`.

## Transactional Append

```typescript
import { EventBusConfig, EventPublisher } from "@croco/events-core";
import { TransactionalOutbox } from "@croco/events-tx";

const outbox = new TransactionalOutbox({
  store,
  txManager,
});

await txManager.run(async () => {
  await orders.insert(order);
  await outbox.append(new OrderCreatedEvent(order.id), {
    aggregateId: order.id,
    idempotencyKey: `order-created:${order.id}`,
  });
});
```

`TransactionalOutbox.append()` fails with `OutboxTransactionRequiredProblem` when no active `tx-core` transaction exists. Storage adapters receive the active transaction client, so the domain write and outbox append share the same commit/rollback boundary.

## Relay

```typescript
import { createEventBusOutboxPublisher, TransactionalOutboxRelay } from "@croco/events-tx";

const relay = new TransactionalOutboxRelay({
  store,
  publish: createEventBusOutboxPublisher(EventBusConfig.getInstance().getEventBus()),
  deadLetter: async (message) => {
    await operations.recordDeadLetter(message);
  },
});

await relay.publishBatch({ limit: 50 });
```

The relay claims visible messages, publishes each one, marks successful messages as `published`, schedules retry with backoff after failures, and marks exhausted messages as `poisoned` or `dead_lettered` when a dead-letter hook is configured. Completion updates are guarded by the claimed attempt number; if another relay already completed or superseded the claim, the batch result reports `stale_claim` without overwriting the newer state.

Publish callbacks receive an optional `AbortSignal`. `stop()` prevents new batches and cancels active callbacks, while `drain(signal)` waits for active batches and reports whether the supplied shutdown boundary expired. Claims whose publication never started are released immediately as `retrying` without consuming an attempt.

`TransactionalOutboxRelay` structurally implements the framework-context shutdown hook, so hosts can register it without adding a dependency from framework-context back to events-tx:

```typescript
import { ShutdownManager } from "@croco/framework-context";

ShutdownManager.getInstance().register(relay);
```

When shutdown starts, the relay stops intake, forwards cancellation to the active publisher, and waits for a deterministic `drained` or `cancelled` outcome. A publisher that ignores cancellation may remain pending after the drain boundary; its claimed row retains the existing visibility-timeout recovery path.

## Inbox Dedupe

```typescript
import { TransactionalInboxConsumer } from "@croco/events-tx";

const consumer = new TransactionalInboxConsumer({
  store,
  consumerId: "billing-projection",
});

await consumer.handle(message, async (outboxMessage) => {
  await projectBillingEvent(outboxMessage);
});
```

Inbox records are keyed by the exact `(consumerId, message idempotency key)` tuple; punctuation in either field does not change that identity boundary. Processed records and processing records with an active lease return `duplicate`. Failed records and processing records whose `lockedUntil` lease has expired can be claimed again.

Each accepted start returns an `attempts` claim. Direct store callers must pass that value as `expectedAttempts` when marking the record processed or failed:

```typescript
const started = await store.startInboxProcessing({
  consumerId: "billing-projection",
  messageId: message.id,
  inboxKey: message.idempotencyKey,
  eventType: message.eventType,
  now: new Date(),
  visibilityTimeoutMs: 30_000,
});

if (started.status === "started") {
  await store.markInboxProcessed({
    consumerId: "billing-projection",
    inboxKey: message.idempotencyKey,
    expectedAttempts: started.record.attempts,
    now: new Date(),
  });
}
```

Completion is a compare-and-set operation over the inbox identity, `processing` status, claimed attempt, and unexpired lease. A stale, expired, or already completed claim fails with `InboxClaimConflictProblem` and leaves the current record unchanged. `TransactionalInboxConsumer` carries the attempt and its configurable `visibilityTimeoutMs` lease automatically.

Operators can reconcile interrupted work by listing `processing` records and comparing `lockedUntil` with the current time. Re-delivering an expired record atomically increments `attempts`, records an `events-tx/inbox-lease-reclaimed` diagnostic, and prevents the previous attempt from completing the newer claim.

## Storage Adapters

- `InMemoryTransactionalEventStore` provides test/local storage plus a `createTxAdapter()` helper for `TxManager` rollback and savepoint fixtures.
- `DrizzleTransactionalEventStore` uses Drizzle query-client methods and exported PostgreSQL table definitions: `transactionalOutboxMessages` and `transactionalInboxRecords`. It uses unique-key conflict handling for outbox idempotency and inbox dedupe.

For rolling deployments, migrate the inbox table before deploying lease-aware consumers:

1. Add the nullable `croco_inbox_records.locked_until` timestamp column and the exported status/lease index.
2. Backfill every existing `processing` row with an operator-chosen lease, for example `updated_at + interval '30 seconds'`, and verify no `processing` row has a null lease.
3. Deploy lease-aware consumers.
4. After all old writers are drained, backfill any processing rows they created during the mixed-version window and verify zero null processing leases again.

A null processing lease fails closed as `duplicate`; it is never reclaimed automatically. This keeps old binaries that do not write leases from racing a new worker during rollout. Operators must backfill or otherwise reconcile such rows before redelivery.

## Validation

```bash
pnpm --filter @croco/events-tx test
pnpm --filter @croco/events-tx typecheck
pnpm --filter @croco/events-tx build
```
