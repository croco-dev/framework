import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPublishJSON = vi.fn();

vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockPublishJSON;
  },
}));

import { QStashTaskRunner } from "../libs/QStashTaskRunner";

describe("QStashTaskRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishJSON = vi.fn().mockResolvedValue({
      messageId: "msg-test-123",
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
});
