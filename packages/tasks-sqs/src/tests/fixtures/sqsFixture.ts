import { ExecutionManagerImpl } from "@croco/execution-core";
import { Component, Context } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
} from "@croco/framework-module";
import { TaskRegistry } from "@croco/tasks-core";
import { vi } from "vitest";
import type { Mock } from "vitest";
import { createSqsTaskHandler } from "../../index";
import type { SqsTaskRecord } from "../../index";
import { MemoryExecutionStore } from "./MemoryExecutionStore";

export const queueArn = "arn:aws:sqs:ap-northeast-2:123456789012:tasks";
export const queueUrl = "https://sqs.ap-northeast-2.amazonaws.com/123456789012/tasks";
export const tenantId = "tenant-a";
export const config = { queueUrl, tenantId, region: "ap-northeast-2" };
export const owned: ReturnType<typeof createApplicationRuntime>[] = [];

type SqsFixture = {
  app: ReturnType<typeof createApplicationRuntime>;
  manager: ExecutionManagerImpl;
  store: MemoryExecutionStore;
  handler: ReturnType<typeof createSqsTaskHandler>;
  seen: { payload: unknown; tenant: string | null; service: object }[];
  flush: Mock<() => Promise<void>>;
  Service: new () => { run(payload: unknown): Promise<unknown> };
};

export function record(id: string, changes: Partial<SqsTaskRecord> = {}): SqsTaskRecord {
  return {
    messageId: id,
    eventSource: "aws:sqs",
    eventSourceARN: queueArn,
    body: JSON.stringify({
      version: 1,
      tenantId,
      taskId: "send",
      dispatchId: id,
      payload: { value: id },
    }),
    ...changes,
  };
}

export async function fixture(
  options: {
    fifo?: boolean;
    handle?: (payload: unknown) => Promise<unknown>;
    store?: MemoryExecutionStore;
    maxAttempts?: number;
    tenant?: string;
  } = {},
): Promise<SqsFixture> {
  const store = options.store ?? new MemoryExecutionStore();
  const manager = new ExecutionManagerImpl(store);
  const seen: { payload: unknown; tenant: string | null; service: object }[] = [];
  @Component()
  class Service {
    async run(payload: unknown): Promise<unknown> {
      seen.push({ payload, tenant: Context.getTenantId(), service: this });
      return options.handle ? options.handle(payload) : "done";
    }
  }
  const registry = new TaskRegistry([
    {
      name: "send",
      target: Service,
      methodName: "run",
      metadata: {
        name: "send",
        target: Service,
        methodName: "run",
        options: { maxAttempts: options.maxAttempts ?? 1 },
      },
    },
  ]);
  const app = createApplicationRuntime(
    defineCrocoApplication({
      name: "sqs-consumer",
      imports: [defineCrocoModule({ name: "service", providers: [Service], exports: [Service] })],
    }),
  );
  owned.push(app);
  await app.initialize();
  const flush = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const handler = createSqsTaskHandler({
    application: app,
    executionManager: manager,
    registry,
    queueArn: options.fifo ? `${queueArn}.fifo` : queueArn,
    tenantId: options.tenant ?? tenantId,
    flush,
  });
  return { app, manager, store, handler, seen, flush, Service };
}
