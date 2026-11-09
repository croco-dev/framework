import { createHash } from "node:crypto";
import { SQSClient } from "@aws-sdk/client-sqs";
import type { SendMessageCommand, SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { ExecutionManagerImpl } from "@croco/execution-core";
import { Component, Context } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
} from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN, TaskRegistry } from "@croco/tasks-core";
import { installTestingTelemetryCapture } from "@croco/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSqsTaskHandler, SqsTaskDispatcher, sqsTasks } from "../index";
import type { SqsTaskRecord } from "../index";
import { MemoryExecutionStore } from "./fixtures/MemoryExecutionStore";

const queueArn = "arn:aws:sqs:ap-northeast-2:123456789012:tasks";
const queueUrl = "https://sqs.ap-northeast-2.amazonaws.com/123456789012/tasks";
const tenantId = "tenant-a";
const config = { queueUrl, tenantId, region: "ap-northeast-2" };
const owned: ReturnType<typeof createApplicationRuntime>[] = [];

afterEach(async () => {
  for (const app of owned.splice(0)) await app.dispose();
  vi.restoreAllMocks();
});

function record(id: string, changes: Partial<SqsTaskRecord> = {}): SqsTaskRecord {
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

async function fixture(
  options: {
    fifo?: boolean;
    handle?: (payload: unknown) => Promise<unknown>;
    store?: MemoryExecutionStore;
    maxAttempts?: number;
    tenant?: string;
  } = {},
) {
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
  const flush = vi.fn().mockResolvedValue(undefined);
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

describe("SqsTaskDispatcher", () => {
  it("publishes through the application dispatcher and actual SDK serialization without network credentials", async () => {
    const sent: { body: string; authorization: string | undefined }[] = [];
    const sdk = new SQSClient({
      region: config.region,
      credentials: { accessKeyId: "fixture-access", secretAccessKey: "fixture-secret" },
      requestHandler: {
        handle: async (request: { body?: unknown; headers: Record<string, string> }) => {
          sent.push({ body: String(request.body), authorization: request.headers.authorization });
          return {
            response: {
              statusCode: 200,
              headers: {
                "content-type": "application/x-amz-json-1.0",
                "x-amzn-requestid": "fixture",
              },
              body: new TextEncoder().encode(
                JSON.stringify({
                  MessageId: "accepted-1",
                  MD5OfMessageBody: createHash("md5")
                    .update(JSON.parse(String(request.body)).MessageBody)
                    .digest("hex"),
                }),
              ),
            },
          };
        },
      },
    });
    const app = createApplicationRuntime(
      defineCrocoApplication({ name: "producer", imports: [sqsTasks({ ...config, client: sdk })] }),
    );
    owned.push(app);
    await app.initialize();
    try {
      expect(
        await app
          .get(TASK_DISPATCHER_TOKEN)
          .execute("send", { amount: 71 }, { delay: 9, idempotencyKey: "order-12" }),
      ).toEqual({ messageId: "accepted-1" });
      const wire = JSON.parse(sent[0]?.body ?? "{}");
      expect(wire).toMatchObject({ QueueUrl: queueUrl, DelaySeconds: 9 });
      expect(JSON.parse(wire.MessageBody)).toMatchObject({
        version: 1,
        tenantId,
        taskId: "send",
        payload: { amount: 71 },
        idempotencyKey: "order-12",
      });
      expect(sent[0]?.authorization).toContain("AWS4-HMAC-SHA256");
      expect(JSON.stringify(app.createGraphManifest())).not.toContain("fixture-secret");
      const consumer = await fixture();
      expect(
        await consumer.handler({ Records: [record("sdk-wire", { body: wire.MessageBody })] }),
      ).toEqual({ batchItemFailures: [] });
      expect(consumer.seen[0]?.payload).toEqual({ amount: 71 });
    } finally {
      sdk.destroy();
    }
  });

  it("scopes FIFO deduplication to queue, tenant and task while retaining logical retry identity", async () => {
    const inputs: SendMessageCommand["input"][] = [];
    const client = {
      send: async (command: SendMessageCommand): Promise<SendMessageCommandOutput> => {
        inputs.push(command.input);
        return { MessageId: "accepted", $metadata: {} };
      },
    };
    const a = new SqsTaskDispatcher({
      ...config,
      queueUrl: `${queueUrl}.fifo`,
      messageGroupId: "customer-12",
      client,
    });
    const b = new SqsTaskDispatcher({
      ...config,
      tenantId: "tenant-b",
      queueUrl: `${queueUrl}.fifo`,
      messageGroupId: "customer-12",
      client,
    });
    await a.execute("send", 7, { idempotencyKey: "logical" });
    await a.execute("send", 7, { idempotencyKey: "logical" });
    await a.execute("other", 7, { idempotencyKey: "logical" });
    await b.execute("send", 7, { idempotencyKey: "logical" });
    await a.execute("send", 7);
    expect(inputs[0]?.MessageGroupId).toBe("customer-12");
    expect(inputs[0]?.MessageDeduplicationId).toMatch(/^sqs:v1:[a-f0-9]{64}$/);
    expect(inputs[1]?.MessageDeduplicationId).toBe(inputs[0]?.MessageDeduplicationId);
    expect(
      new Set([
        inputs[0]?.MessageDeduplicationId,
        inputs[2]?.MessageDeduplicationId,
        inputs[3]?.MessageDeduplicationId,
        inputs[4]?.MessageDeduplicationId,
      ]).size,
    ).toBe(4);
    await expect(a.execute("send", 7, { delay: 0 })).rejects.toMatchObject({
      code: "tasks-sqs/invalid-message",
    });
    expect(inputs).toHaveLength(5);
  });

  it.each([
    { delay: -1 },
    { delay: 901 },
    { delay: 1.5 },
    { delay: NaN },
    { idempotencyKey: "" },
    { headers: { Authorization: "secret" } },
    { messageGroupId: "fifo-only" },
  ])("rejects unsupported dispatch options before send: %o", async (options) => {
    const send = vi.fn();
    await expect(
      new SqsTaskDispatcher({ ...config, client: { send } }).execute("send", {}, options),
    ).rejects.toMatchObject({ code: "tasks-sqs/invalid-message" });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([undefined, () => 1, BigInt(1), "x".repeat(1_048_576)])(
    "rejects missing, non-serializable and oversized payloads",
    async (payload) => {
      const send = vi.fn();
      await expect(
        new SqsTaskDispatcher({ ...config, client: { send } }).execute("send", payload),
      ).rejects.toMatchObject({ code: "tasks-sqs/invalid-message" });
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("does not expose upstream secrets or call publication success on an unknown receipt", async () => {
    for (const send of [
      vi.fn().mockRejectedValue(new Error("fixture-secret tenant-private payload credential")),
      vi.fn().mockResolvedValue({ $metadata: {} }),
    ]) {
      try {
        await new SqsTaskDispatcher({ ...config, client: { send } }).execute("send", {
          private: "payload",
        });
        expect.fail("must reject");
      } catch (error) {
        expect(error).toMatchObject({
          code: "tasks-sqs/publish-failed",
          extensions: { outcome: "unknown", retryable: false },
        });
        expect(JSON.stringify(error)).not.toMatch(/fixture-secret|tenant-private|credential/);
        expect((error as Error).cause).toBeUndefined();
      }
      expect(send).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects missing configuration before any credential or network request", () => {
    const send = vi.fn();
    expect(() => new SqsTaskDispatcher({ ...config, region: "", client: { send } })).toThrow(
      expect.objectContaining({ code: "tasks-sqs/invalid-configuration" }),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("closes owned SDK clients at app disposal and leaves externally owned clients alone", async () => {
    const destroy = vi.spyOn(SQSClient.prototype, "destroy");
    const app = createApplicationRuntime(
      defineCrocoApplication({ name: "owned-sdk", imports: [sqsTasks(config)] }),
    );
    await app.initialize();
    const dispatcher = app.get(TASK_DISPATCHER_TOKEN);
    await app.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
    await expect(dispatcher.execute("send", {})).rejects.toMatchObject({
      code: "tasks-sqs/invalid-message",
    });
    const external = new SQSClient({ region: config.region });
    const runner = new SqsTaskDispatcher({ ...config, client: external });
    runner.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
    external.destroy();
  });
});

describe("createSqsTaskHandler", () => {
  it("ends the task span only after settlement and records handler failure evidence", async () => {
    const capture = installTestingTelemetryCapture();
    const f = await fixture({
      handle: async () => {
        throw new Error("synthetic task failure");
      },
    });
    await capture.run(() => f.handler({ Records: [record("traced")] }));
    expect(capture.spans).toMatchObject([
      {
        name: "sqs.task.consume",
        ended: true,
        attributes: { "messaging.system": "aws_sqs" },
        exceptions: [expect.anything()],
      },
    ]);
  });
  it("rejects overlapping redelivery while the first execution owns its attempt", async () => {
    let release: () => void = () => {};
    let started: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const f = await fixture({
      handle: async () => {
        started();
        await held;
      },
    });
    const first = f.handler({ Records: [record("concurrent")] });
    await ready;
    expect(await f.handler({ Records: [record("concurrent")] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "concurrent" }],
    });
    expect(f.seen).toHaveLength(1);
    release();
    expect(await first).toEqual({ batchItemFailures: [] });
    expect(await f.handler({ Records: [record("concurrent")] })).toEqual({ batchItemFailures: [] });
    expect(f.seen).toHaveLength(1);
  });
  it("runs the configured app service and tenant, commits completion and suppresses duplicate delivery", async () => {
    const f = await fixture();
    const first = record("message-1");
    expect(await f.handler({ Records: [first] })).toEqual({ batchItemFailures: [] });
    expect(await f.handler({ Records: [{ ...first, messageId: "provider-redelivery" }] })).toEqual({
      batchItemFailures: [],
    });
    expect(f.seen).toEqual([
      { payload: { value: "message-1" }, tenant: tenantId, service: f.app.get(f.Service) },
    ]);
    expect(await f.store.list()).toMatchObject([{ status: "completed", attempts: 1 }]);
    expect(f.flush).toHaveBeenCalledTimes(2);
    expect(Context.getTenantId()).toBeNull();
  });

  it("keeps application and tenant scopes isolated across concurrent consumers", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const a = await fixture({
      handle: async () => {
        await held;
        expect(Context.getTenantId()).toBe("tenant-a");
      },
    });
    const b = await fixture({
      tenant: "tenant-b",
      handle: async () => {
        expect(Context.getTenantId()).toBe("tenant-b");
        release();
      },
    });
    await Promise.all([
      a.handler({ Records: [record("a")] }),
      b.handler({
        Records: [
          record("b", {
            body: JSON.stringify({
              version: 1,
              tenantId: "tenant-b",
              taskId: "send",
              dispatchId: "b",
              payload: 2,
            }),
          }),
        ],
      }),
    ]);
    expect(a.seen[0]?.service).not.toBe(b.seen[0]?.service);
    expect(a.seen[0]?.tenant).toBe("tenant-a");
    expect(b.seen[0]?.tenant).toBe("tenant-b");
  });

  it("reports only failed standard-queue records and resumes retrying execution through TaskRunner", async () => {
    let failed = true;
    const f = await fixture({
      maxAttempts: 2,
      handle: async (payload) => {
        if ((payload as { value: string }).value === "bad" && failed) {
          failed = false;
          throw new Error("temporary");
        }
        return "sent";
      },
    });
    expect(await f.handler({ Records: [record("good"), record("bad"), record("last")] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "bad" }],
    });
    expect((await f.store.list()).map((item) => item.status)).toEqual([
      "completed",
      "retrying",
      "completed",
    ]);
    expect(await f.handler({ Records: [record("bad")] })).toEqual({ batchItemFailures: [] });
    expect((await f.store.list()).find((item) => item.attempts === 2)?.status).toBe("completed");
  });

  it("does not run later FIFO records after failure, leaving them for redelivery in order", async () => {
    const f = await fixture({
      fifo: true,
      handle: async () => {
        throw new Error("failed");
      },
    });
    const records = ["first", "second", "third"].map((id) =>
      record(id, { eventSourceARN: `${queueArn}.fifo` }),
    );
    expect(await f.handler({ Records: records })).toEqual({
      batchItemFailures: records.map((item) => ({ itemIdentifier: item.messageId })),
    });
    expect(f.seen).toHaveLength(1);
    expect(await f.store.list()).toMatchObject([{ status: "failed", attempts: 1 }]);
    await f.handler({ Records: [records[0] as SqsTaskRecord] });
    expect(f.seen).toHaveLength(1); // terminal poison remains failed for native DLQ; no implicit new execution
  });

  it("never acknowledges an unsettled handler or a failed completion write", async () => {
    let release: () => void = () => {};
    let started: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const f = await fixture({
      handle: async () => {
        started();
        await held;
        return "sent";
      },
    });
    let settled = false;
    const invocation = f.handler({ Records: [record("held")] }).then((value) => {
      settled = true;
      return value;
    });
    await ready;
    expect(settled).toBe(false);
    expect(await f.store.list()).toMatchObject([{ status: "running" }]);
    vi.spyOn(f.store, "updateIfStatusAndAttempt").mockRejectedValueOnce(
      new Error("storage offline"),
    );
    release();
    expect(await invocation).toEqual({ batchItemFailures: [{ itemIdentifier: "held" }] });
    expect(await f.handler({ Records: [record("held")] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "held" }],
    });
    expect(f.seen).toHaveLength(1); // unresolved running state requires execution recovery, not overlap
  });

  it("rejects reusing a logical identity for a different payload without rerunning effects", async () => {
    const f = await fixture();
    const input = record("identity");
    await f.handler({ Records: [input] });
    const altered = { ...JSON.parse(input.body), payload: { value: "different" } };
    expect(await f.handler({ Records: [{ ...input, body: JSON.stringify(altered) }] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "identity" }],
    });
    expect(f.seen).toHaveLength(1);
  });

  it.each([
    "null",
    "[]",
    "{}",
    "{",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 1,
      tenantId: "other",
      taskId: "send",
      dispatchId: "id",
      payload: {},
    }),
  ])("leaves malformed or unauthorized body for native redrive: %s", async (body) => {
    const f = await fixture();
    expect(await f.handler({ Records: [record("poison", { body })] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "poison" }],
    });
    expect(f.seen).toHaveLength(0);
    expect(await f.store.list()).toEqual([]);
  });

  it("rejects a forged source and unknown task before service effects", async () => {
    const f = await fixture();
    const unknown = { ...JSON.parse(record("unknown").body), taskId: "unregistered" };
    expect(
      await f.handler({
        Records: [
          record("forged", { eventSourceARN: `${queueArn}-other` }),
          record("unknown", { body: JSON.stringify(unknown) }),
        ],
      }),
    ).toEqual({ batchItemFailures: [{ itemIdentifier: "forged" }, { itemIdentifier: "unknown" }] });
    expect(await f.store.list()).toEqual([]);
  });

  it("rejects non-Lambda events, duplicate record identities and disposed application callbacks", async () => {
    const f = await fixture();
    await expect(f.handler({} as never)).rejects.toMatchObject({
      code: "tasks-sqs/unsupported-host-event",
    });
    await expect(f.handler({ Records: [record("same"), record("same")] })).rejects.toMatchObject({
      code: "tasks-sqs/unsupported-host-event",
    });
    await f.app.dispose();
    await expect(async () => f.handler({ Records: [record("late")] })).rejects.toMatchObject({
      code: expect.stringContaining("disposed"),
    });
  });

  it("does not hide telemetry flush failure behind a successful acknowledgement", async () => {
    const f = await fixture();
    f.flush.mockRejectedValueOnce(new Error("flush failed"));
    await expect(f.handler({ Records: [record("flushed")] })).rejects.toThrow("flush failed");
    expect(await f.handler({ Records: [record("flushed")] })).toEqual({ batchItemFailures: [] });
    expect(f.seen).toHaveLength(1);
  });
});
