# @croco/tasks-sqs

Alpha AWS SQS implementation of `TaskDispatcher`, with an explicit Lambda SQS consumer.
The publisher runs on Node or Lambda. Consumption uses a Lambda event source mapping;
there is no Node poller or Workers entrypoint. Local SDK and Lambda-event fixtures do
not certify a deployed queue, IAM policy, DLQ, database or AWS account.

## Application composition

```ts typecheck
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN } from "@croco/tasks-core";
import { sqsTasks } from "@croco/tasks-sqs";

const application = createApplicationRuntime(
  defineCrocoApplication({
    name: "orders",
    imports: [
      sqsTasks({
        queueUrl: "https://sqs.ap-northeast-2.amazonaws.com/123456789012/orders",
        region: "ap-northeast-2",
        tenantId: "tenant-a",
      }),
    ],
  }),
);
await application.initialize();
const accepted = await application
  .get(TASK_DISPATCHER_TOKEN)
  .execute("orders.fulfill", { orderId: "order-71" }, { idempotencyKey: "order-71" });
// accepted.messageId means SQS accepted publication, not that the task completed.
await application.dispose();
```

The AWS SDK uses its credential chain; grant only the intended queue's `sqs:SendMessage`.
An optional `client` is externally owned. The application disposes internally created
clients through module shutdown; imports alone create no SDK client or consumer.
Cleanup belongs to each application's SQS module instance. Replacing `TASK_DISPATCHER_TOKEN`
leaves the replacement's lifecycle with the application that supplied it.
Create a dispatcher for each server-authorized tenant/queue binding. Never construct
these options from untrusted request fields. Plugin metadata excludes configured values.

Payloads use JSON serialization. Missing root payloads, serialization errors and bodies
over 1 MiB are rejected. Standard queues accept integer `delay` seconds from 0 through 900. HTTP `headers` are unsupported and rejected rather than treated as authentication.
For FIFO queues select a nonempty `messageGroupId` on the dispatcher or its concrete
`execute` options. FIFO rejects per-message delay. Group IDs use 1–128 printable ASCII
characters without spaces. Deduplication IDs hash queue, tenant, task and logical key;
without a key, each publish has a fresh identity. FIFO deduplication is only SQS's
bounded delivery window, not permanent execution idempotency.

## Lambda consumer

```ts typecheck
import { createSqsTaskHandler } from "@croco/tasks-sqs";
import type { ApplicationRuntime } from "@croco/framework-module";
import type { ExecutionManager } from "@croco/execution-core";
import type { TaskRegistry } from "@croco/tasks-core";

declare const application: ApplicationRuntime;
declare const executionManager: ExecutionManager;
declare const registry: TaskRegistry;
declare const telemetry: { flush(): Promise<void> };

// application, executionManager and registry come from this app's composition root.
// The registry is app-owned; decorated services use the generated DI graph.
export const handler = createSqsTaskHandler({
  application,
  executionManager,
  registry,
  queueArn: "arn:aws:sqs:ap-northeast-2:123456789012:orders",
  tenantId: "tenant-a",
  flush: () => telemetry.flush(),
});
```

Initialize the application before invocation and keep its lifecycle owned by the app.
The callback uses `ApplicationRuntime.bindHostCallback`, a fresh request scope per
record, the configured tenant context and app service resolution. It never trusts
payload/header roles or tenant claims: the versioned envelope must match the configured
tenant and the event must match the exact queue ARN. Restrict Lambda invocation to the
trusted SQS mapping and administrators; do not expose this handler through a Function
URL, API Gateway or an arbitrary-event endpoint. Checking `eventSourceARN` is routing
validation, not a cryptographic signature. IAM and queue resource policies own trust.

Configure `ReportBatchItemFailures` on the event source mapping. Standard queues
continue independent records after a failure. FIFO stops after the first failure and
returns failed and unprocessed IDs, preserving order. No message is deleted by this
package; Lambda performs acknowledgement from the returned response. A record succeeds
only after `TaskRunner` has committed completion, or has read an already completed
matching execution. App-owned `flush` finishes before the response; failure rejects
the invocation, and redelivery reuses completed execution evidence.

Use a durable, tenant-authorized `ExecutionManager` store with atomic create-by-key and
status transitions. `TaskRunner` owns all execution attempts, task retry classification,
timeouts and indeterminate recovery. The provider does not create another ledger.
Execution identity includes queue ARN, tenant, task and the logical idempotency key
(or dispatch ID). Keep those receipts for the entire queue retention, DLQ and replay
horizon. Reusing a key for different payloads fails through the existing execution
fingerprint contract. Concurrent delivery cannot start an already running execution.

Malformed, unauthorized, unknown-task, terminal-failure and unresolved-running messages
remain failed for native SQS redrive. Configure a DLQ and finite `maxReceiveCount`,
monitor it, and perform reviewed recovery/replay through the existing execution tools.
This package neither drops poison messages nor automatically retries terminal or
indeterminate task outcomes. SQS receive attempts and TaskRunner attempts are distinct.
Set queue visibility to cover Lambda timeout and batch processing; configure the Lambda
timeout to leave room for durable settlement and telemetry flush. Host interruption or
visibility expiry can redeliver a message; neither implies cancellation of remote effects
or exactly-once execution. A hung handler is not acknowledged early.

Publication failures report `tasks-sqs/publish-failed` with `outcome: unknown` and omit
raw SDK errors, endpoints, credentials and payloads. The SDK owns native request retries;
the plugin adds no blind publication retry. Before manual republication, reconcile
the original acceptance, execution and effects. A keyed retry preserves the original
queue, tenant, task, key and payload, using the same durable execution ledger and its
retained receipts. Changing the queue, identity scope or ledger creates a different
deduplication boundary. Without an original caller key, each publication also creates a
new dispatch ID. Either change requires proven original non-acceptance or independent
effect deduplication. Other stable diagnostics
are `tasks-sqs/invalid-configuration`, `tasks-sqs/invalid-message` and
`tasks-sqs/unsupported-host-event`. Non-SQS host events reject the invocation.

## Verification and infrastructure limits

Run `pnpm --filter @croco/tasks-sqs... build`, then
`pnpm --filter @croco/tasks-sqs test` and `pnpm --filter @croco/tasks-sqs typecheck`.
The suite covers real SDK signing/serialization with synthetic transport, shared
TaskDispatcher/no-credential conformance, existing ExecutionManager/TaskRunner integration,
tenant/app isolation, duplicate/conflicting identities, FIFO failure order, failed
settlement, interrupted pending work, poison messages and flush failure.

Kubernetes/Node supports publication conditionally on SDK credentials and queue access;
Node consumption is unsupported. Lambda additionally needs a trusted event source mapping,
durable execution store, visibility/redrive settings and app-owned flush. Cloudflare Workers
is unsupported. Generated SaaS profile integration remains separate under #3536. Live
AWS IAM enforcement, delivery/visibility timing and actual DLQ redrive are unverified.
See [AWS partial batch responses](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html)
and [SendMessage](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html).
