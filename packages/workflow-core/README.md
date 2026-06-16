# @croco/workflow-core

Croco-native workflow definitions that connect trigger metadata, task execution, and execution inspection records.

## Features

- `@Workflow` method decorator for declaring a workflow entrypoint.
- Automatic connection to `@Cron`, `@OnEvent`, and `@OnWebhook` metadata on the same method.
- Task step validation against `@croco/tasks-core` registrations.
- Parent `workflow` execution records with child task executions through `TaskRunner`.
- Optional execution logs, idempotency keys, cancellation, and replay delegation through `@croco/execution-core`.

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
