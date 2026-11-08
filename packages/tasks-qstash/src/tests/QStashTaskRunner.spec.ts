import { createQStashTaskConformanceSuite } from "@croco/testing";
import { Task, taskRef } from "@croco/tasks-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as QStashSdk from "@upstash/qstash";

let mockPublishJSON = vi.fn();

vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockPublishJSON;
  },
}));

import { QStashTaskRunner } from "../libs/QStashTaskRunner";

type PublishJsonRecord = {
  readonly body?: unknown;
  readonly deduplicationId?: string;
  readonly delay?: number;
  readonly headers?: Record<string, string>;
  readonly url?: string;
};

const QSTASH_LIVE_ENV = [
  "CROCO_LIVE_QSTASH",
  "UPSTASH_QSTASH_TOKEN",
  "UPSTASH_QSTASH_DESTINATION_URL",
] as const;
const SECRET_SAMPLE = "super-secret-token";
const SECRET_RICH_ERROR_MESSAGE = `Authorization: Bearer ${SECRET_SAMPLE}; "token":"${SECRET_SAMPLE}"; https://qstash.upstash.io?token=${SECRET_SAMPLE}; Cookie: session=${SECRET_SAMPLE}`;

function createUpstreamError(message: string, status: number): Error & { readonly status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function getPublishJsonRecords(): PublishJsonRecord[] {
  return mockPublishJSON.mock.calls.map((call) => call[0] as PublishJsonRecord);
}

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for QStash live smoke.`);
  }

  return value;
}

async function runQStashLiveSmoke(): Promise<void> {
  const { Client } = await vi.importActual<typeof QStashSdk>("@upstash/qstash");
  const client = new Client({ token: readRequiredEnv("UPSTASH_QSTASH_TOKEN") });
  const deduplicationId = `croco-tasks-qstash:${Date.now()}`;
  const response = await client.publishJSON({
    body: {
      payload: { source: "tasks-qstash-live-smoke" },
      taskId: "croco.tasks-qstash.live-smoke",
    },
    deduplicationId,
    url: readRequiredEnv("UPSTASH_QSTASH_DESTINATION_URL"),
  });

  expect(typeof response.messageId).toBe("string");
  expect(response.messageId.length).toBeGreaterThan(0);
}

describe("QStashTaskRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishJSON = vi.fn().mockResolvedValue({
      messageId: "msg-test-123",
    });
  });

  describe("QStash task conformance", () => {
    it.each(
      createQStashTaskConformanceSuite({
        createMissingConfig: () =>
          new QStashTaskRunner({
            token: "",
            destinationUrl: "https://example.com/api/tasks/webhook",
          }),
        createPublisher: (scenario) => {
          if (scenario === "success") {
            mockPublishJSON.mockResolvedValue({ messageId: "msg-conformance" });
          }

          if (scenario === "retryable-upstream") {
            mockPublishJSON.mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 503));
          }

          if (scenario === "terminal-upstream") {
            mockPublishJSON.mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 400));
          }

          return {
            publisher: new QStashTaskRunner({
              token: "test-token",
              destinationUrl: "https://example.com/api/tasks/webhook",
            }),
            getPublishedMessages: getPublishJsonRecords,
          };
        },
        liveSmoke: {
          isEnabled: () =>
            isTruthyEnv("CROCO_LIVE_QSTASH") &&
            QSTASH_LIVE_ENV.every((name) => Boolean(process.env[name])),
          requiredEnv: QSTASH_LIVE_ENV,
          run: runQStashLiveSmoke,
        },
        providerName: "tasks-qstash",
        secretSamples: [SECRET_SAMPLE],
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  it("should publish task to QStash with correct body", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
    });

    const result = await runner.execute("send-email", { userId: "user-123" });

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://example.com/api/tasks/webhook",
      body: {
        taskId: "send-email",
        payload: { userId: "user-123" },
      },
      delay: undefined,
      headers: {},
    });
    expect(result.messageId).toBe("msg-test-123");
  });

  it("should publish task references by name", async () => {
    class SendEmailTask {
      @Task({ name: "send-email" })
      run(payload: { userId: string }): void {
        void payload;
      }
    }

    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
    });

    const result = await runner.execute(taskRef(SendEmailTask, "run"), { userId: "user-123" });

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://example.com/api/tasks/webhook",
      body: {
        taskId: "send-email",
        payload: { userId: "user-123" },
      },
      delay: undefined,
      headers: {},
    });
    expect(result.messageId).toBe("msg-test-123");
  });

  it("accepts HTTPS destination URLs", () => {
    expect(
      () =>
        new QStashTaskRunner({
          token: "test-token",
          destinationUrl: "https://example.com/api/tasks/webhook",
        }),
    ).not.toThrow();
  });

  it("rejects HTTP destination URLs", () => {
    expect(
      () =>
        new QStashTaskRunner({
          token: "test-token",
          destinationUrl: "http://example.com/api/tasks/webhook",
        }),
    ).toThrow("QStash destinationUrl must use https.");
  });

  it("should use default delay when provided", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
      defaultDelay: 30,
    });

    await runner.execute("process-payment", { amount: 100 });

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://example.com/api/tasks/webhook",
      body: {
        taskId: "process-payment",
        payload: { amount: 100 },
      },
      delay: 30,
      headers: {},
    });
  });

  it("should override default delay with option", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
      defaultDelay: 30,
    });

    await runner.execute("send-notification", { message: "hello" }, { delay: 60 });

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://example.com/api/tasks/webhook",
      body: {
        taskId: "send-notification",
        payload: { message: "hello" },
      },
      delay: 60,
      headers: {},
    });
  });

  it("should merge default headers with option headers", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
      defaultHeaders: { "X-Default": "value1" },
    });

    await runner.execute("sync-data", { data: "test" }, { headers: { "X-Custom": "value2" } });

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://example.com/api/tasks/webhook",
      body: {
        taskId: "sync-data",
        payload: { data: "test" },
      },
      delay: undefined,
      headers: {
        "X-Default": "value1",
        "X-Custom": "value2",
      },
    });
  });

  it("should allow option headers to override default headers", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
      defaultHeaders: { "X-Api-Key": "default-key" },
    });

    await runner.execute(
      "export-report",
      { format: "pdf" },
      { headers: { "X-Api-Key": "override-key" } },
    );

    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://example.com/api/tasks/webhook",
      body: {
        taskId: "export-report",
        payload: { format: "pdf" },
      },
      delay: undefined,
      headers: {
        "X-Api-Key": "override-key",
      },
    });
  });

  it("scopes deduplication to the destination, task and caller key", async () => {
    const enqueued: PublishJsonRecord[] = [];
    const messages = new Map<string, string>();
    mockPublishJSON.mockImplementation(async (request: PublishJsonRecord) => {
      const previous = request.deduplicationId && messages.get(request.deduplicationId);
      if (previous) return { messageId: previous };
      const messageId = `msg-${enqueued.length}`;
      enqueued.push(request);
      if (request.deduplicationId) messages.set(request.deduplicationId, messageId);
      return { messageId };
    });
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
    });
    const otherDestination = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/other-tasks/webhook",
    });
    const restarted = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.com/api/tasks/webhook",
    });
    const options = { idempotencyKey: "order-1" };
    const first = await runner.execute("sync-customer", { customerId: "customer-123" }, options);
    const otherTask = await runner.execute("send-email", { to: "user@example.test" }, options);
    const otherUrl = await otherDestination.execute("sync-customer", {}, options);
    const otherKey = await runner.execute("sync-customer", {}, { idempotencyKey: "order-2" });
    const retry = await restarted.execute("sync-customer", { customerId: "customer-123" }, options);

    expect(
      new Set([first.messageId, otherTask.messageId, otherUrl.messageId, otherKey.messageId]).size,
    ).toBe(4);
    expect(retry).toEqual(first);
    expect(enqueued).toHaveLength(4);
    expect(enqueued[0]?.deduplicationId).toBe(
      "croco-task-v1:111a33d7183693695a7f86ea95044b60f96aa02f43418dc914ca4dcff5422c49",
    );
    expect(enqueued[0]?.body).toEqual({
      taskId: "sync-customer",
      payload: { customerId: "customer-123" },
    });
  });

  it("keeps tuple boundaries distinct and encodes long Unicode keys in bounded ASCII ids", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.test/tasks",
    });
    for (const [task, key] of [
      ["a:b", "c"],
      ["a", "b:c"],
      ["a", "b:c "],
      ["a", "주문🔑".repeat(10_000)],
    ]) {
      await runner.execute(task, {}, { idempotencyKey: key });
    }
    const ids = getPublishJsonRecords().map((record) => record.deduplicationId);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(/^croco-task-v1:[a-f0-9]{64}$/);
  });

  it("reuses the accepted message after its publish acknowledgement is lost", async () => {
    const messages = new Map<string | undefined, string>();
    mockPublishJSON.mockImplementation(async (request: PublishJsonRecord) => {
      const previous = messages.get(request.deduplicationId);
      if (previous) return { messageId: previous };
      messages.set(request.deduplicationId, "msg-accepted");
      throw createUpstreamError("acknowledgement lost", 503);
    });
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.test/tasks",
    });
    const options = { idempotencyKey: "order-1" };
    await expect(runner.execute("send-email", { orderId: 1 }, options)).rejects.toMatchObject({
      code: "tasks-qstash/publish-failed",
    });
    await expect(runner.execute("send-email", { orderId: 1 }, options)).resolves.toEqual({
      messageId: "msg-accepted",
    });
    expect(messages.size).toBe(1);
    expect(getPublishJsonRecords()[0]?.deduplicationId).toMatch(/^croco-task-v1:[a-f0-9]{64}$/);
    expect(getPublishJsonRecords()[1]?.deduplicationId).toBe(
      getPublishJsonRecords()[0]?.deduplicationId,
    );
  });

  it("keeps the same caller identity when payload, delay or forwarded headers change", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.test/tasks",
    });
    await runner.execute("send-email", { amount: 17 }, { idempotencyKey: "order-1" });
    await runner.execute(
      "send-email",
      { amount: 29 },
      { idempotencyKey: "order-1", delay: 30, headers: { "X-Version": "2" } },
    );
    const [first, retry] = getPublishJsonRecords();
    expect(first?.deduplicationId).toMatch(/^croco-task-v1:[a-f0-9]{64}$/);
    expect(retry?.deduplicationId).toBe(first?.deduplicationId);
    expect(retry?.body).toEqual({ taskId: "send-email", payload: { amount: 29 } });
  });

  it("publishes every unkeyed call without adding a deduplication id", async () => {
    const runner = new QStashTaskRunner({
      token: "test-token",
      destinationUrl: "https://example.test/tasks",
    });
    await runner.execute("send-email", {});
    await runner.execute("send-email", {});
    expect(getPublishJsonRecords()).toHaveLength(2);
    for (const record of getPublishJsonRecords())
      expect(record).not.toHaveProperty("deduplicationId");
  });
});
