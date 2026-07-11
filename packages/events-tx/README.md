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

Inbox records are keyed by `consumerId` and message idempotency key. Processed or currently processing records return `duplicate`; failed records can be retried explicitly.

Each accepted start returns an `attempts` claim. Direct store callers must pass that value as `expectedAttempts` when marking the record processed or failed:

```typescript
const started = await store.startInboxProcessing({
  consumerId: "billing-projection",
  messageId: message.id,
  inboxKey: message.idempotencyKey,
  eventType: message.eventType,
  now: new Date(),
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

Completion is a compare-and-set operation over the inbox identity, `processing` status, and claimed attempt. A stale or already completed claim fails with `InboxClaimConflictProblem` and leaves the current record unchanged. `TransactionalInboxConsumer` carries this claim automatically.

## Storage Adapters

- `InMemoryTransactionalEventStore` provides test/local storage plus a `createTxAdapter()` helper for `TxManager` rollback and savepoint fixtures.
- `DrizzleTransactionalEventStore` uses Drizzle query-client methods and exported PostgreSQL table definitions: `transactionalOutboxMessages` and `transactionalInboxRecords`. It uses unique-key conflict handling for outbox idempotency and inbox dedupe.

## Validation

```bash
pnpm --filter @croco/events-tx test
pnpm --filter @croco/events-tx typecheck
pnpm --filter @croco/events-tx build
```
