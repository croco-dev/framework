# @croco/outbox-core

Provider-neutral transactional outbox storage contracts for Croco side-effect intents.

`@croco/outbox-core` defines the public `TransactionalOutboxStore` boundary used by database-backed outbox implementations. It models tenant-scoped idempotency, source event/command identifiers, trace context, retry metadata, claim leases, and Problem-backed dispatch failures without depending on Drizzle, `tx-core`, or event runtime packages.

## Contract

```typescript
import type { TransactionalOutboxStore } from "@croco/outbox-core";

declare const store: TransactionalOutboxStore;

const record = await store.record(
  {
    type: "email.send",
    tenant: { tenantId: "tenant_123" },
    idempotencyKey: "welcome:user_123",
    source: {
      commandId: "cmd_123",
      commandType: "user.register",
    },
    payload: { userId: "user_123" },
  },
  { now: new Date() },
);

const [claimed] = await store.claimBatch({
  limit: 10,
  now: new Date(),
  visibilityTimeoutMs: 30_000,
});
```

Use `createTransactionalOutboxStoreContractSuite` to verify provider implementations against duplicate idempotency keys, delimiter-safe tenant and idempotency boundaries, Unit-of-Work rollback, concurrent claims, dispatch success, retryable failure, terminal failure, and stale claim behavior.
