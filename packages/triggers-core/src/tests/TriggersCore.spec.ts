import { describe, expect, it } from "vitest";
import { CRON_METADATA_KEY, Cron } from "../libs/decorators/Cron";
import { EVENT_METADATA_KEY, OnEvent } from "../libs/decorators/OnEvent";
import { OnWebhook, WEBHOOK_METADATA_KEY } from "../libs/decorators/OnWebhook";
import { TRIGGER_METADATA_KEY, TriggerRegistry, triggerRegistry } from "../libs/TriggerRegistry";
import type {
  AnyTriggerMetadata,
  CronOptions,
  CronTriggerMetadata,
  EventOptions,
  EventTriggerMetadata,
  TriggerMetadata,
  TriggerType,
  WebhookOptions,
  WebhookTriggerMetadata,
} from "../libs/types";

describe("@croco/triggers-core package exports", () => {
  it("should export Cron decorator", () => {
    expect(typeof Cron).toBe("function");
  });

  it("should export CRON_METADATA_KEY symbol", () => {
    expect(typeof CRON_METADATA_KEY).toBe("symbol");
  });

  it("should export OnEvent decorator", () => {
    expect(typeof OnEvent).toBe("function");
  });

  it("should export EVENT_METADATA_KEY symbol", () => {
    expect(typeof EVENT_METADATA_KEY).toBe("symbol");
  });

  it("should export OnWebhook decorator", () => {
    expect(typeof OnWebhook).toBe("function");
  });

  it("should export WEBHOOK_METADATA_KEY symbol", () => {
    expect(typeof WEBHOOK_METADATA_KEY).toBe("symbol");
  });

  it("should export TRIGGER_METADATA_KEY symbol", () => {
    expect(typeof TRIGGER_METADATA_KEY).toBe("symbol");
  });

  it("should export TriggerRegistry class", () => {
    expect(typeof TriggerRegistry).toBe("function");
    expect(typeof TriggerRegistry.getInstance).toBe("function");
  });

  it("should export triggerRegistry instance", () => {
    expect(triggerRegistry).toBeInstanceOf(TriggerRegistry);
  });

  it("should export TriggerType type", () => {
    const typeCheck1: TriggerType = "cron";
    const typeCheck2: TriggerType = "event";
    const typeCheck3: TriggerType = "webhook";
    expect([typeCheck1, typeCheck2, typeCheck3]).toEqual(["cron", "event", "webhook"]);
  });

  it("should export TriggerMetadata type", () => {
    const typeCheck: TriggerMetadata = {
      type: "cron",
      methodName: "testMethod",
      target: class Test {},
    };
    expect(typeCheck.type).toBe("cron");
  });

  it("should export CronTriggerMetadata type", () => {
    const typeCheck: CronTriggerMetadata = {
      type: "cron",
      expression: "0 0 * * *",
      methodName: "testMethod",
      target: class Test {},
    };
    expect(typeCheck.expression).toBe("0 0 * * *");
  });

  it("should export EventTriggerMetadata type", () => {
    const typeCheck: EventTriggerMetadata = {
      type: "event",
      event: "TestEvent",
      methodName: "testMethod",
      target: class Test {},
    };
    expect(typeCheck.event).toBe("TestEvent");
  });

  it("should export WebhookTriggerMetadata type", () => {
    const typeCheck: WebhookTriggerMetadata = {
      type: "webhook",
      path: "/webhooks/test",
      method: "POST",
      methodName: "testMethod",
      target: class Test {},
    };
    expect(typeCheck.path).toBe("/webhooks/test");
  });

  it("should export AnyTriggerMetadata type", () => {
    const typeCheck1: AnyTriggerMetadata = {
      type: "cron",
      expression: "0 0 * * *",
      methodName: "testMethod",
      target: class Test {},
    };
    const typeCheck2: AnyTriggerMetadata = {
      type: "event",
      event: "TestEvent",
      methodName: "testMethod",
      target: class Test {},
    };
    const typeCheck3: AnyTriggerMetadata = {
      type: "webhook",
      path: "/webhooks/test",
      method: "POST",
      methodName: "testMethod",
      target: class Test {},
    };
    expect([typeCheck1.type, typeCheck2.type, typeCheck3.type]).toEqual([
      "cron",
      "event",
      "webhook",
    ]);
  });

  it("should export CronOptions type", () => {
    const typeCheck: CronOptions = {
      name: "test-cron",
      description: "Test cron job",
      enabled: true,
      timezone: "UTC",
    };
    expect(typeCheck.timezone).toBe("UTC");
  });

  it("should export EventOptions type", () => {
    const typeCheck: EventOptions = {
      name: "test-event",
      description: "Test event handler",
      enabled: true,
      concurrency: 5,
      timeout: 10000,
    };
    expect(typeCheck.concurrency).toBe(5);
  });

  it("should export WebhookOptions type", () => {
    const typeCheck: WebhookOptions = {
      name: "test-webhook",
      description: "Test webhook handler",
      enabled: true,
      auth: true,
      cors: {
        origin: "https://example.com",
        methods: ["POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      },
    };
    expect(typeCheck.cors?.origin).toBe("https://example.com");
  });
});
