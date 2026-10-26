# @croco/workflow-core

Croco-native workflow definitions that connect trigger metadata, task execution, and execution inspection records.

## Features

- `@Workflow` method decorator for declaring a workflow entrypoint.
- Typed workflow definitions built from `taskRef` references with inferred step inputs and results.
- Automatic connection to `@Cron`, `@OnEvent`, and `@OnWebhook` metadata on the same method.
- Task step validation against `@croco/tasks-core` registrations.
- Parent `workflow` execution records with child task executions through `TaskRunner`.
- Optional execution logs, idempotency keys, cancellation, and replay delegation through `@croco/execution-core`.
- `WorkflowDiagnosticsProvider` for exposing registered workflows and workflow execution status through `@croco/diagnostics-core`.
- Telemetry spans and lifecycle events for workflow execution, step execution, reuse, completion, and failure.

## Cancellation

`await runner.cancel(executionId, reason)` persists the parent's `cancelled` status. The runner reads
that status immediately before each child dispatch and before completing the workflow. Cancellation
observed at either boundary stops subsequent dispatch and rejects the active `execute()` call with
`WorkflowExecutionCancelledProblem` (`workflow-core/workflow-execution-cancelled`, non-retryable).
The parent retains its cancellation record; the runner does not complete or fail it.

An already dispatched task may settle successfully or fail and retains its own execution outcome.
Cancellation does not abort JavaScript tasks or compensate their effects. The status read and child
dispatch are separate operations: cancellation completed before the boundary read prevents dispatch,
but cancellation racing after that read may overlap one dispatch. Cross-record atomic dispatch and
distributed queue cancellation require a transport/store-specific coordination contract.

## Install

```bash
pnpm add @croco/workflow-core
```

## Usage

```typescript
import { Component } from "@croco/framework-context";
import { Task, TaskRunner, taskRef } from "@croco/tasks-core";
import { OnWebhook } from "@croco/triggers-core";
import { defineWorkflow, Workflow, WorkflowRegistry, WorkflowRunner } from "@croco/workflow-core";

type BillingPayload = {
  subscriptionId: string;
};

@Component()
class BillingTasks {
  @Task({ name: "billing.fetch-subscription" })
  fetchSubscription(payload: BillingPayload) {
    return { subscriptionId: payload.subscriptionId, plan: "pro" };
  }

  @Task({ name: "billing.sync-entitlements" })
  syncEntitlements(payload: { subscriptionId: string; plan: string }) {
    return { synchronized: payload.subscriptionId };
  }
}

const fetchSubscription = taskRef(BillingTasks, "fetchSubscription", "billing.fetch-subscription");
const syncEntitlements = taskRef(BillingTasks, "syncEntitlements", "billing.sync-entitlements");

const billingWorkflow = defineWorkflow<BillingPayload>({
  name: "billing-webhook",
  idempotencyKey: ({ payload }) => `billing:${payload.subscriptionId}`,
})
  .step(fetchSubscription)
  .step("sync", syncEntitlements, ({ previousResults }) => previousResults[0].result)
  .build();

@Component()
class BillingWorkflows {
  @OnWebhook("/webhooks/billing", "POST")
  @Workflow(billingWorkflow)
  billingWebhook() {}
}

const registry = WorkflowRegistry.fromMetadata();
const taskRunner = new TaskRunner(executionManager, registry.taskRegistry, undefined, {
  serviceResolver: (target) => applicationRuntime.get(target),
});
const runner = new WorkflowRunner(executionManager, registry, taskRunner);
const result = await runner.execute(billingWorkflow, { subscriptionId: "sub_123" });

if (!result.reused) {
  result.steps[0].result.plan;
  result.steps[1].result.synchronized;
}
```

`defineWorkflow()` checks each input resolver against the referenced task payload. It also preserves
the ordered step results, so `previousResults` and a non-reused `WorkflowRunner.execute()` result are
inferred from the definition.

Pass the application's `TaskRunner` as the third constructor argument when steps target classes.
Its `serviceResolver` resolves task instances from the initialized application runtime and preserves
that application's dependency graph and scopes. Without a resolver, class task execution fails with
`TaskRunnerDIFailureProblem`; it does not resolve services from a global container. Object-backed
task targets can use the default runner without a resolver.

### Migrating string definitions

Legacy string task names and string runner execution remain supported migration paths. Existing workflows can
continue to use `steps: ["billing.sync"]` and `runner.execute("billing-webhook", payload)` while each
step is migrated to `taskRef()` and `defineWorkflow()`.

```typescript
@Workflow({
  name: "billing-webhook",
  steps: ["billing.sync"],
})
billingWebhook() {}

await runner.execute("billing-webhook", { subscriptionId: "sub_123" });
```

Retryable workflow failures use the parent execution's `maxAttempts`. If a retryable failure leaves an
idempotent workflow in `retrying`, calling `execute()` again with the same idempotency key resumes the
same parent execution for the next attempt instead of returning it as a reused execution. Typed workflows
persist a versioned fingerprint of the workflow name, ordered step names and task names, input-resolver
presence, and declared workflow/task execution options. Function bodies and JavaScript class or method
names are excluded, so formatting, transpilation, and minification do not invalidate retries when explicit
workflow and task names remain stable. A retry resumes only when this structural fingerprint matches.
For incompatible payload, result, or resolver changes that keep the same structure, use a new explicit
workflow or task name (for example, a version suffix). Runtime fingerprints cannot verify TypeScript types.
Legacy string workflows retain their existing retry behavior.

The structural fingerprint uses `workflow-contract:v2`. Existing typed executions persisted with a v1
fingerprint cannot be safely compared with v2 and are rejected on retry. Drain those retries with the
previous deployment before upgrading; do not rewrite stored fingerprints to bypass the contract check.

## Operations

```typescript
import { DiagnosticsCollector } from "@croco/diagnostics-core";
import { WorkflowDiagnosticsProvider, WorkflowRegistry } from "@croco/workflow-core";

const collector = new DiagnosticsCollector();
collector.registerProvider(
  new WorkflowDiagnosticsProvider(executionManager, WorkflowRegistry.fromMetadata()),
);
```

The provider reports workflow names, trigger types, execution status counts, replay references
(`replayOf`), failure messages, log counts, and the latest log message. It does not include workflow
payloads, results, or structured log data in diagnostics output.

## Clock injection

The runners and in-memory saga store accept optional `() => Date` callbacks; existing constructor
calls use the system clock. `SagaRunner` uses its clock for lifecycle, step, compensation, replay,
outbox timestamps, and the time component of invocation IDs. Its default store shares that clock.
A supplied store owns its creation timestamps and must be configured separately.

```typescript typecheck
import type { ExecutionManager } from "@croco/execution-core";
import { TaskRunner } from "@croco/tasks-core";
import {
  InMemorySagaStore,
  SagaRunner,
  WorkflowRegistry,
  WorkflowRunner,
} from "@croco/workflow-core";

declare const executionManager: ExecutionManager;
const registry = WorkflowRegistry.fromMetadata();
const taskRunner = new TaskRunner(executionManager, registry.taskRegistry);
const clock = () => new Date("2030-01-01T00:00:00.000Z");
const sagaRunner = new SagaRunner(undefined, clock);
// With an explicit store:
const sagaStore = new InMemorySagaStore(clock);
const storedSagaRunner = new SagaRunner(sagaStore, clock);
const workflowRunner = new WorkflowRunner(executionManager, registry, taskRunner, clock);
```

`WorkflowRunner` uses the callback for the time component of workflow invocation IDs. Invocation IDs
retain their random suffix. Execution records, logs, and delegated replay retain the execution
manager/store's time ownership; configure `ExecutionManagerImpl` with `{ clock }` and configure the
execution store's clock as supported. Task timing remains owned by `TaskRunner`, whose runtime accepts
`{ now: () => clock().getTime() }` independently. Clock injection does not change timeout scheduling.

### Saga request identity

A keyed `SagaRunner.execute()` binds the saga name and a detached canonical payload snapshot to a
versioned SHA-256 `requestFingerprint`. Equal payloads reuse the execution (or retain its existing
in-flight/failure behavior); a different payload produces non-retryable
`workflow-core/saga-store-conflict` before recovery, outbox dispatch or step execution.
Object insertion order does not affect identity. Canonical values and unsupported data follow the
Saga outbox rules below. Unkeyed execution and explicit `replay()` payload overrides keep their
existing semantics; replay does not reuse the original request key.

`SagaStore.create()` must atomically return the winning `(sagaName, idempotencyKey)` record and
persist `requestFingerprint` alongside its payload and metadata. The runner checks both lookup and
create-race results. Existing records without a fingerprint are compared against their recorded
payload without rewriting history; unsupported legacy payloads fail closed with a Saga definition
Problem. Adapters may deploy the optional field additively; this package supplies only an in-memory
Saga store and performs no database migration. A legacy adapter that drops the field retains payload
comparison but must preserve the original payload as immutable evidence. New adapters must persist
the fingerprint so later handler mutation cannot redefine the accepted request.

### Saga outbox replay identity

Publishers must deduplicate by the opaque `SagaOutboxRecord.deliveryId`. New IDs bind the
original execution, step, phase, message position and canonical message content (`id`, `topic`,
`payload`, `idempotencyKey`, `metadata`) using SHA-256. Changed content receives a different ID;
equal content retains its ID across retries and the entire replay chain, even when object keys
are reordered. Execution timestamps and publication status do not participate. Payload and metadata are detached
snapshots when the identity is bound, so later input mutations cannot change the recorded effect.

Replay searches its recorded ancestors before issuing a new ID. An equal message in the same
step/phase/position retains its stored ID, including IDs written before content fingerprinting.
Existing records are not rewritten. If that stored ID already identifies conflicting content in
the ancestry, replay and direct pending-message dispatch fail instead of publishing an unverified duplicate.
If identity finalization fails after a forward handler succeeds, the successful result remains eligible
for compensation; unverified outbox messages are not published.

Canonical values distinguish primitive types, undefined, non-finite numbers, negative zero,
bigints, Date timestamps, array positions (including holes), sorted enumerable array properties
and sorted plain-object properties.
Functions, symbols, enumerable symbol keys, cycles, invalid dates and other object types cannot
be fingerprinted and produce a Saga definition failure. This does not provide durable publishing
or repair previously ambiguous downstream receipts; existing store and publisher guarantees still apply.

### Saga compensation recording failures

When a successful step's completion write and its fallback failure write both fail, the runner
retains the step's result for reverse compensation without rerunning the effect. The completion
write remains the original failure; the fallback write joins the recording errors below. If
compensation can be persisted, its step record retains that result. Otherwise recovery still
requires reconciliation with the external effect; in-memory evidence is not durable storage.

If saving a `compensation_failed` step record fails, the runner still attempts the remaining
completed steps' compensations in reverse order. Business and compensation errors remain separate
in `SagaExecutionFailedProblem`. Recording errors are attached as its non-enumerable
`sagaFailureRecordError`: the original error for one failure, or an `AggregateError` containing
all recording errors in order, including a later terminal-write error. The existing failure-record
telemetry event reports this attachment.

A successful terminal write records the execution as `failed`, even when individual step records
remain `compensating` because their failure writes were not confirmed. If the terminal write also
fails, durable execution state may remain `running`; the returned Problem reports failure and
retains the recording evidence. Reconcile uncertain records using the store and external compensation
receipts before replaying. This does not provide durable recovery when the store cannot write.

When step-failure or compensation-failure recording errors were collected, automatic outbox dispatch is deferred
so a publisher failure cannot mask that evidence. Successfully recorded compensation messages remain
pending and can be delivered through `SagaRunner.dispatchOutbox()` after handling the failure.
