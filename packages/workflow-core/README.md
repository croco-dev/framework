# @croco/workflow-core

Croco-native workflow definitions that connect trigger metadata, task execution, and execution inspection records.

## Features

- `@Workflow` method decorator for declaring a workflow entrypoint.
- Automatic connection to `@Cron`, `@OnEvent`, and `@OnWebhook` metadata on the same method.
- Task step validation against `@croco/tasks-core` registrations.
- Parent `workflow` execution records with child task executions through `TaskRunner`.
- Optional execution logs, idempotency keys, cancellation, and replay delegation through `@croco/execution-core`.
- `WorkflowDiagnosticsProvider` for exposing registered workflows and workflow execution status through `@croco/diagnostics-core`.
- Telemetry spans and lifecycle events for workflow execution, step execution, reuse, completion, and failure.

## Install

```bash
pnpm add @croco/workflow-core
```

## Usage

```typescript
import { Task } from "@croco/tasks-core";
import { OnWebhook } from "@croco/triggers-core";
import { Workflow, WorkflowRunner } from "@croco/workflow-core";

class BillingTasks {
  @Task({ name: "billing.sync" })
  async sync(payload: { subscriptionId: string }) {
    return { synced: payload.subscriptionId };
  }
}

class BillingWorkflows {
  @OnWebhook("/webhooks/billing", "POST")
  @Workflow({
    name: "billing-webhook",
    steps: ["billing.sync"],
    idempotencyKey: ({ payload }) =>
      typeof payload === "object" && payload !== null && "subscriptionId" in payload
        ? `billing:${String(payload.subscriptionId)}`
        : undefined,
  })
  billingWebhook() {}
}

const runner = new WorkflowRunner(executionManager);
await runner.execute("billing-webhook", { subscriptionId: "sub_123" });
```

Retryable workflow failures use the parent execution's `maxAttempts`. If a retryable failure leaves an
idempotent workflow in `retrying`, calling `execute()` again with the same idempotency key resumes the
same parent execution for the next attempt instead of returning it as a reused execution.

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
