import { randomUUID } from "node:crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import type {
  TaskDispatcher,
  TaskDispatchOptions,
  TaskDispatchResult,
  TaskReference,
} from "@croco/tasks-core";
import { requireConfiguration, requiredString, taskIdentity } from "./envelope";
import {
  SqsTaskConfigurationProblem,
  SqsTaskMessageProblem,
  SqsTaskPublishProblem,
} from "./problems/SqsTaskProblems";

/** An externally owned SDK client may be shared; only internally created clients are destroyed. */
export interface SqsTaskClient {
  send(command: SendMessageCommand): Promise<SendMessageCommandOutput>;
}

export type SqsTaskDispatcherOptions = {
  readonly queueUrl: string;
  /** Server-configured tenant authority. Use a separate dispatcher for each tenant. */
  readonly tenantId: string;
  readonly region: string;
  readonly messageGroupId?: string;
  readonly client?: SqsTaskClient;
};

export type SqsTaskDispatchOptions = TaskDispatchOptions & {
  readonly messageGroupId?: string;
};

/** Publishes versioned task envelopes using the AWS SDK credential chain and native retry policy. */
export class SqsTaskDispatcher implements TaskDispatcher {
  private readonly options: SqsTaskDispatcherOptions;
  private readonly client: SqsTaskClient;
  private readonly ownedClient?: SQSClient;
  private readonly fifo: boolean;
  private disposed = false;

  constructor(options: SqsTaskDispatcherOptions) {
    requireConfiguration(options.queueUrl, "queueUrl");
    requireConfiguration(options.tenantId, "tenantId");
    requireConfiguration(options.region, "region");
    let url: URL;
    try {
      url = new URL(options.queueUrl);
    } catch {
      throw new SqsTaskConfigurationProblem("queueUrl");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new SqsTaskConfigurationProblem("queueUrl");
    }
    this.fifo = url.pathname.endsWith(".fifo");
    if (
      options.messageGroupId !== undefined &&
      (!this.fifo || !validGroup(options.messageGroupId))
    ) {
      throw new SqsTaskConfigurationProblem("messageGroupId");
    }
    this.options = Object.freeze({ ...options });
    if (options.client) {
      this.client = options.client;
    } else {
      this.ownedClient = new SQSClient({ region: options.region });
      this.client = this.ownedClient;
    }
  }

  async execute(
    task: string | TaskReference,
    payload: unknown,
    options: SqsTaskDispatchOptions = {},
  ): Promise<TaskDispatchResult> {
    const taskId = typeof task === "string" ? task : task.name;
    const group = options.messageGroupId ?? this.options.messageGroupId;
    if (
      this.disposed ||
      !requiredString(taskId) ||
      (options.headers !== undefined && Object.keys(options.headers).length > 0) ||
      (options.idempotencyKey !== undefined && !requiredString(options.idempotencyKey)) ||
      (options.delay !== undefined &&
        (!Number.isInteger(options.delay) ||
          options.delay < 0 ||
          options.delay > 900 ||
          this.fifo)) ||
      (this.fifo ? !validGroup(group) : group !== undefined)
    )
      throw new SqsTaskMessageProblem();

    const dispatchId = randomUUID();
    let body: string;
    try {
      body = JSON.stringify({
        version: 1,
        tenantId: this.options.tenantId,
        taskId,
        dispatchId,
        ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
        payload,
      });
      // Reject values that JSON would silently drop (e.g. undefined at the payload root).
      if (
        !Object.hasOwn(JSON.parse(body) as object, "payload") ||
        Buffer.byteLength(body) > 1_048_576
      ) {
        throw new SqsTaskMessageProblem();
      }
    } catch {
      throw new SqsTaskMessageProblem();
    }
    const command = new SendMessageCommand({
      QueueUrl: this.options.queueUrl,
      MessageBody: body,
      ...(options.delay === undefined ? {} : { DelaySeconds: options.delay }),
      ...(this.fifo
        ? {
            MessageGroupId: group,
            MessageDeduplicationId: taskIdentity(
              this.options.queueUrl,
              this.options.tenantId,
              taskId,
              options.idempotencyKey ?? dispatchId,
            ),
          }
        : {}),
    });
    try {
      const result = await this.client.send(command);
      if (!requiredString(result.MessageId)) throw new SqsTaskPublishProblem();
      return { messageId: result.MessageId };
    } catch {
      throw new SqsTaskPublishProblem();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ownedClient?.destroy();
  }
}

function validGroup(value: unknown): value is string {
  return typeof value === "string" && /^[\x21-\x7e]{1,128}$/.test(value);
}
