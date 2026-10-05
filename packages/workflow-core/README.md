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
