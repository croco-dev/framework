# @croco/features-drizzle

## Durable experiments

`DrizzleExperimentStore` persists the `ExperimentStore` contract independently of
policy releases. Run the additive, idempotent `createExperimentsSchema(database)`
migration before using it. `dropExperimentsSchema` is for isolated tests or an explicitly
authorized teardown; it removes experiment history. Existing policy tables are unchanged.

Assignments have a unique experiment revision, explicit scope and stable subject key.
Competing workers return the stored winner even after reconnecting. State commands,
configuration receipts and audit entries commit atomically under a lock on the same
experiment row used by assignment and treatment admission. A pause that acquires the
lock first blocks admission; an already admitted handler may finish after pause. Period
checks use the supplied admission-request timestamp, rather than a new clock read after
lock acquisition. Queue delay has no fixed upper bound here; use deployment database
timeouts when a maximum delay is required.
Separate deliveries create separate exposures, while retransmitting the same delivery
returns its original exposure. Late exposures retain their original assignment.

Inject this store into `ExperimentRuntime` with server authorization. The SQL adapter
enforces assignment ownership and scope, and the runtime owns registration validation
and actor authorization. Neither client-selected variants nor arbitrary client tenant
claims should reach these trusted boundaries.

`FEATURES_POSTGRES_URL=... pnpm --filter @croco/features-drizzle test:postgres` exercises
real PostgreSQL concurrency with two independent pools, a fresh connection, state
races, receipt conflicts, exposure deduplication and tenant isolation.

PostgreSQL persistence for the policy release contract in `@croco/features-core`.

The adapter stores policy definitions, immutable revision rows, a scope head used for revision CAS,
review snapshots, one activation pointer per policy scope, command receipts, decision references, and
schedule metadata. `createFeaturesSchema` is idempotent and can run during application startup or a
database migration step.

## Scheduled publication bridge

`ScheduledPolicyPublisher` connects a reviewed `PolicyReleaseService.schedule` command to
`ExecutionManager` and a verified trigger delivery:

1. `schedule(command)` invokes the supplied core `publish` callback with a future `effectiveAt`.
   The core service authorizes the command and checks its review, then persists the scheduled revision and
   delivery together. The bridge creates an execution with a deterministic idempotency key. If a `PolicyTriggerDispatcher` is configured, it dispatches the payload with a
   delay until `effectiveAt`.
2. The trigger endpoint verifies its provider signature and message identity, then calls
   `handleVerifiedDelivery({ scheduleId, deliveryId })`.
3. The bridge claims the schedule with a lease, invokes the core service's `publish(command)` callback,
   completes the execution, and marks the schedule completed.
4. `recoverDue()` is called after a process restart. It scans due and expired-lease rows, reuses the
   same execution idempotency key, and dispatches a new recovery trigger using the persisted schedule update time as its delivery idempotency key. The command receipt remains the final
   duplicate guard when a provider redelivers or a worker lease is taken over.

The dispatcher is deliberately small so an application can adapt the existing QStash task publisher
or another authenticated trigger. The delivery handler must be called only after the existing trigger
verification boundary has accepted the request; this package does not treat an unverified HTTP payload
as a publish command.

## Existing trigger composition

Register the delivery target with `@Cron` from `@croco/triggers-core` and route authenticated
QStash requests through `QStashTriggerHandler`. The application supplies its receiver,
`deliveryIdentityVerifier`, execution manager, and service resolver to that handler.

```typescript typecheck
import { Cron } from "@croco/triggers-core";
import { ScheduledPolicyPublisher } from "@croco/features-drizzle";
import type { QStashWebhookPayload, QStashTriggerExecutionContext } from "@croco/triggers-qstash";

class PolicyDelivery {
  constructor(private readonly publisher: ScheduledPolicyPublisher) {}

  @Cron("* * * * *", { name: "policy-release" })
  deliver(payload: QStashWebhookPayload, context: QStashTriggerExecutionContext) {
    return this.publisher.handleVerifiedDelivery({
      scheduleId: payload.scheduleId,
      deliveryId: context.executionId,
    });
  }
}
```

The dispatcher sends the existing QStash webhook envelope with the durable policy `scheduleId`,
`className: 'PolicyDelivery'`, `methodName: 'deliver'`, `triggerName: 'policy-release'`,
`cronExpression: '* * * * *'`, and an ISO `timestamp`. Schedule recovery can dispatch the same
policy again; execution and publication receipts make that delivery idempotent. The package test
runs this registered target through `QStashTriggerHandler` with local provider fixtures and verifies
that a rejected delivery identity cannot publish.

## PostgreSQL concurrency

Revision writes lock the scope head and compare the expected revision in the same transaction. Active
state is one row per `(policy_id, scope_key)`, and command receipts are unique on
`(policy_id, scope_key, idempotency_key)`. Reusing a command key with a different fingerprint raises a
stable idempotency conflict. Schedule claims lock one row and allow takeover only after its lease expires.

The live test file uses two PostgreSQL pools when `FEATURES_POSTGRES_URL` is set. It is skipped when no
test database is configured, matching the other Drizzle packages.
