import type { ExecutionManager } from "@croco/execution-core";
import { Container, MetadataStorage } from "@croco/framework-context";
import { createQStashTriggerConformanceSuite } from "@croco/testing";
import { triggerRegistry } from "@croco/triggers-core";
import type { Client, Receiver } from "@upstash/qstash";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QStashScheduler } from "../libs/QStashScheduler";
import { QStashTriggerHandler } from "../libs/QStashTriggerHandler";

type ConformanceScenario = "success" | "retryable-upstream" | "terminal-upstream";

const QSTASH_TRIGGER_LIVE_ENV = [
  "CROCO_LIVE_QSTASH",
  "QSTASH_TOKEN",
  "QSTASH_TRIGGER_WEBHOOK_URL",
] as const;
const SECRET_SAMPLE = "super-secret-token";
const SECRET_RICH_ERROR_MESSAGE = `Authorization: Bearer ${SECRET_SAMPLE}; "token":"${SECRET_SAMPLE}"; https://qstash.upstash.io?token=${SECRET_SAMPLE}; Cookie: session=${SECRET_SAMPLE}`;

function createUpstreamError(message: string, status: number): Error & { readonly status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function createTriggerConformanceHarness(scenario: ConformanceScenario) {
  const scheduleOperations: Array<Record<string, unknown>> = [];
  const executionEvents: Array<Record<string, unknown>> = [];

  class ConformanceTrigger {
    async run(): Promise<string> {
      return "handled";
    }
  }

  triggerRegistry.register({
    type: "cron",
    expression: "*/5 * * * *",
    methodName: "run",
    target: ConformanceTrigger.prototype,
    options: {
      name: "conformance-job",
    },
  });

  const create = vi.fn().mockImplementation(async (operation: Record<string, unknown>) => {
    scheduleOperations.push(operation);
    return {};
  });

  if (scenario === "retryable-upstream") {
    create.mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 503));
  }

  if (scenario === "terminal-upstream") {
    create.mockRejectedValue(createUpstreamError(SECRET_RICH_ERROR_MESSAGE, 400));
  }

  const client = {
    schedules: {
      create,
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
    },
  } as unknown as Client;

  const receiver = {
    verify: vi.fn().mockImplementation(async ({ signature }: { readonly signature: string }) => {
      if (signature !== "valid-signature") {
        throw new Error("invalid signature");
      }
    }),
  } as unknown as Receiver;

  const executionManager = {
    cancel: vi.fn(),
    checkpoint: vi.fn(),
    complete: vi.fn().mockImplementation(async (id: string, result: unknown) => {
      executionEvents.push({ id, result, type: "complete" });
    }),
    create: vi.fn().mockImplementation(async (input: unknown) => {
      executionEvents.push({ input, type: "create" });
      return { id: "exec-conformance" };
    }),
    fail: vi.fn().mockImplementation(async (id: string, failure: unknown) => {
      executionEvents.push({ failure, id, type: "fail" });
    }),
    retry: vi.fn(),
    start: vi.fn().mockImplementation(async (id: string) => {
      executionEvents.push({ id, type: "start" });
      return {};
    }),
    timeout: vi.fn(),
    updateProgress: vi.fn(),
  } as unknown as ExecutionManager;

  return {
    getExecutionEvents: () => executionEvents,
    getScheduleOperations: () => scheduleOperations,
    handler: new QStashTriggerHandler({
      deliveryIdentityVerifier: vi.fn().mockResolvedValue(true),
      executionManager,
      receiver,
      serviceResolver: () => new ConformanceTrigger(),
    }),
    scheduler: new QStashScheduler({
      client,
      webhookUrl: "https://example.com/triggers/conformance",
    }),
    validSignature: "valid-signature",
    webhookBody: JSON.stringify({
      className: "ConformanceTrigger",
      cronExpression: "*/5 * * * *",
      methodName: "run",
      scheduleId: "croco-trigger:ConformanceTrigger:conformance-job:run",
      timestamp: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      triggerName: "conformance-job",
    }),
  };
}

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for QStash trigger live smoke.`);
  }

  return value;
}

async function runQStashTriggerLiveSmoke(): Promise<void> {
  const { Client } = await import("@upstash/qstash");

  class LiveSmokeTrigger {
    async run(): Promise<void> {}
  }

  triggerRegistry.register({
    type: "cron",
    expression: "*/10 * * * *",
    methodName: "run",
    target: LiveSmokeTrigger.prototype,
    options: {
      name: "live-smoke",
    },
  });

  const client = new Client({ token: readRequiredEnv("QSTASH_TOKEN") });
  const scheduler = new QStashScheduler({
    client,
    schedulePrefix: `croco-trigger-live-${Date.now()}`,
    webhookUrl: readRequiredEnv("QSTASH_TRIGGER_WEBHOOK_URL"),
  });
  let scheduleId: string | undefined;

  try {
    const result = await scheduler.sync();
    expect(result.created).toBe(1);
    scheduleId = result.details[0]?.name;
  } finally {
    if (scheduleId) {
      await client.schedules.delete(scheduleId).catch(() => undefined);
    }
  }
}

describe("@croco/triggers-qstash", () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
    vi.restoreAllMocks();
  });

  describe("QStash trigger conformance", () => {
    it.each(
      createQStashTriggerConformanceSuite({
        createHarness: createTriggerConformanceHarness,
        liveSmoke: {
          isEnabled: () =>
            isTruthyEnv("CROCO_LIVE_QSTASH") &&
            QSTASH_TRIGGER_LIVE_ENV.every((name) => Boolean(process.env[name])),
          requiredEnv: QSTASH_TRIGGER_LIVE_ENV,
          run: runQStashTriggerLiveSmoke,
        },
        providerName: "triggers-qstash",
        secretSamples: [SECRET_SAMPLE],
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  it("package exports should be available", async () => {
    const { QStashScheduler, QStashTriggerHandler } = await import("../index");

    expect(QStashScheduler).not.toBeUndefined();
    expect(QStashTriggerHandler).not.toBeUndefined();
  });
});
