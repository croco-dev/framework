import { createHash } from "node:crypto";
import { SQSClient } from "@aws-sdk/client-sqs";
import type { SendMessageCommand, SendMessageCommandOutput } from "@aws-sdk/client-sqs";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN } from "@croco/tasks-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SqsTaskDispatcher, sqsTasks } from "../index";
import { config, fixture, owned, queueUrl, record, tenantId } from "./fixtures/sqsFixture";

afterEach(async () => {
  for (const app of owned.splice(0)) await app.dispose();
  vi.restoreAllMocks();
});

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

  it.each([false, true])(
    "leaves application replacements alone at shutdown (disposable: %s)",
    async (disposable) => {
      const destroy = vi.spyOn(SQSClient.prototype, "destroy");
      const dispose = vi.fn();
      const replacement = {
        execute: vi.fn().mockResolvedValue({ messageId: "replacement-message" }),
        ...(disposable ? { dispose } : {}),
      };
      const app = createApplicationRuntime(
        defineCrocoApplication({
          name: "replacement-sdk",
          imports: [sqsTasks(config)],
          providerReplacements: [
            {
              provider: { provide: TASK_DISPATCHER_TOKEN, useValue: replacement },
              replaces: ["@croco/tasks-sqs/dispatcher"],
            },
          ],
        }),
      );
      await app.initialize();
      expect(app.get(TASK_DISPATCHER_TOKEN)).toBe(replacement);
      await expect(app.dispose()).resolves.toBeUndefined();
      expect(dispose).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
    },
  );

  it("keeps cleanup independent when two applications reuse one plugin", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "accepted", $metadata: {} });
    const plugin = sqsTasks({ ...config, client: { send } });
    const first = createApplicationRuntime(
      defineCrocoApplication({ name: "first", imports: [plugin] }),
    );
    const second = createApplicationRuntime(
      defineCrocoApplication({ name: "second", imports: [plugin] }),
    );
    owned.push(first, second);
    await first.initialize();
    await second.initialize();
    const firstDispatcher = first.get(TASK_DISPATCHER_TOKEN);
    const secondDispatcher = second.get(TASK_DISPATCHER_TOKEN);
    await first.dispose();
    await expect(firstDispatcher.execute("send", {})).rejects.toMatchObject({
      code: "tasks-sqs/invalid-message",
    });
    await expect(secondDispatcher.execute("send", {})).resolves.toEqual({ messageId: "accepted" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
