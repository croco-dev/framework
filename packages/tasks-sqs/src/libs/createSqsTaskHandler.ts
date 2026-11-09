import { Context } from "@croco/framework-context";
import type { ApplicationRuntime } from "@croco/framework-module";
import type { ExecutionManager } from "@croco/execution-core";
import { TaskRunner } from "@croco/tasks-core";
import type { TaskRegistry } from "@croco/tasks-core";
import { withSpan } from "@croco/telemetry-api";
import { decodeEnvelope, requireConfiguration, requiredString, taskIdentity } from "./envelope";
import {
  SqsTaskConfigurationProblem,
  SqsTaskHostProblem,
  SqsTaskMessageProblem,
} from "./problems/SqsTaskProblems";

export type SqsTaskRecord = {
  readonly messageId: string;
  readonly body: string;
  readonly eventSource: string;
  readonly eventSourceARN: string;
};
export type SqsTaskEvent = { readonly Records: readonly SqsTaskRecord[] };
export type SqsTaskBatchResponse = {
  readonly batchItemFailures: readonly { readonly itemIdentifier: string }[];
};

export type SqsTaskHandlerOptions = {
  readonly application: ApplicationRuntime;
  readonly executionManager: ExecutionManager;
  readonly registry: TaskRegistry;
  /** Exact trusted mapping identity; the Lambda function must not expose a public invoke endpoint. */
  readonly queueArn: string;
  /** Trusted tenant authority for this queue, never derived from message headers or payload. */
  readonly tenantId: string;
  /** Await app-owned telemetry flush before acknowledging a batch. A failure rejects the batch. */
  readonly flush: () => Promise<void>;
};

/** Lambda-only consumer. Poison and terminal messages remain failed for native SQS redrive/DLQ. */
export function createSqsTaskHandler(
  options: SqsTaskHandlerOptions,
): (event: SqsTaskEvent) => Promise<SqsTaskBatchResponse> {
  requireConfiguration(options.queueArn, "queueArn");
  requireConfiguration(options.tenantId, "tenantId");
  if (
    !/^arn:(aws|aws-cn|aws-us-gov):sqs:[a-z0-9-]+:\d{12}:[A-Za-z0-9_-]+(?:\.fifo)?$/.test(
      options.queueArn,
    )
  ) {
    throw new SqsTaskConfigurationProblem("queueArn");
  }
  const { application, executionManager, registry, queueArn, tenantId, flush } = options;
  const fifo = queueArn.endsWith(".fifo");
  const runner = new TaskRunner(executionManager, registry, undefined, {
    serviceResolver: (target) => application.get(target),
  });

  return application.bindHostCallback(async (event: SqsTaskEvent) => {
    // A malformed host event has no reliable record IDs: reject the invocation, never acknowledge it.
    if (
      !event ||
      !Array.isArray(event.Records) ||
      event.Records.some(
        (record) => !record || !requiredString(record.messageId) || typeof record.body !== "string",
      ) ||
      new Set(event.Records.map((record) => record.messageId)).size !== event.Records.length
    ) {
      throw new SqsTaskHostProblem();
    }
    const failures: { itemIdentifier: string }[] = [];
    let stopped = false;
    try {
      for (const record of event.Records) {
        if (stopped) {
          failures.push({ itemIdentifier: record.messageId });
          continue;
        }
        try {
          await Context.run({ requestId: record.messageId, tenantId }, () =>
            withSpan(
              async () => {
                if (
                  record.eventSource !== "aws:sqs" ||
                  record.eventSourceARN !== queueArn ||
                  Buffer.byteLength(record.body) > 1_048_576
                ) {
                  throw new SqsTaskMessageProblem();
                }
                const envelope = decodeEnvelope(record.body, tenantId);
                await runner.executeTracked(envelope.taskId, envelope.payload, {
                  idempotencyKey: taskIdentity(
                    queueArn,
                    tenantId,
                    envelope.taskId,
                    envelope.idempotencyKey ?? envelope.dispatchId,
                  ),
                  metadata: { provider: "sqs", messageId: record.messageId },
                });
              },
              { name: "sqs.task.consume", attributes: { "messaging.system": "aws_sqs" } },
            ),
          );
        } catch {
          failures.push({ itemIdentifier: record.messageId });
          if (fifo) stopped = true;
        }
      }
    } finally {
      await flush();
    }
    return { batchItemFailures: failures };
  });
}
