# @croco/etl-events-tx

Connect a server-confirmed `@croco/events-tx` outbox message to an open warehouse candidate. The integration does not publish a warehouse snapshot or change the shared outbox status. A successful `accepted-durable` result means the warehouse write has a recoverable receipt; readers only see the fact after the candidate is sealed and published.

```typescript no-check
import { AnalyticsOutboxConsumer } from "@croco/etl-events-tx";
import {
  PostgresQuarantineStore,
  installPostgresQuarantineSchema,
} from "@croco/etl-events-tx/postgres";

await installPostgresQuarantineSchema(pool);
const consumer = new AnalyticsOutboxConsumer({
  store: eventStore,
  consumerId: "capture-facts-v1",
  sourceRef: "orders-outbox",
  writer,
  quarantine: new PostgresQuarantineStore(pool),
  resolveBinding: async () => ({ access: serverAccess, candidateId, fence }),
  mapRows: async (envelope, message) => [
    {
      provider: "payments",
      captureId: String(message.payload.captureId),
      occurredAt: envelope.occurredAt,
      amount: String(message.payload.amount),
    },
  ],
});

await consumer.handle(message);
```

The server appends `metadata.analytics = { sourceRef, schemaVersion, subject, origin }` with the domain event inside the same transaction as its domain state change. `eventId` and `occurredAt` come from the durable outbox record; they are not taken from a client request. The fact mapper chooses the descriptor's grain, such as `(provider, captureId)`. A refund maps to a separate refund fact. The mapper must not use `eventId` as a replacement for business grain.

The consumer uses the existing per-consumer inbox. The warehouse batch ID is the stable tuple `[sourceRef, outboxMessageId]`. A durable write receipt, or a durable receipt found by reconciliation after an indeterminate write, permits inbox completion. A missing or rejected receipt leaves the inbox unprocessed so relay delivery can retry. Fact conflicts and invalid envelopes enter the durable quarantine ledger before inbox completion. Other warehouse contract failures and unavailable storage remain failures. Quarantine stores identifiers and a diagnostic code, never the event payload or secrets. A new `consumerId` allows an explicit reimport with an independent inbox and quarantine decision.

`replayById(messageId, { kind: 'outbox', knownHistoryFrom, retainedFrom })` reads exactly one retained outbox ID. An absent ID returns `unavailable` with the supplied retention descriptor; it does not imply that the event never existed. The integration does not scan by `MAX(id)`, infer commit order from timestamps, or rebuild pruned events from current domain state. Archive replay requires a separately implemented archive source.

The caller owns the relay retry limit, candidate lifecycle, retention policy, authenticated warehouse access, and source mapping. A warehouse outage after the domain transaction does not undo the domain command or rerun it. The outbox remains an at-least-once delivery source, while the warehouse grain and batch receipt absorb redelivery.
