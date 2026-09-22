import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiTelemetryBridge, type AiTelemetrySpanAdapter } from "../libs/AiTelemetryBridge";
import type { AiUsageRecord } from "../libs/types";

describe("AiTelemetryBridge", () => {
  let bridge!: AiTelemetryBridge;
  let mockSpan!: AiTelemetrySpanAdapter;
  let capturedAttributes!: Record<string, unknown>;
  let capturedEvents!: Array<{ name: string; attributes: Record<string, unknown> }>;

  beforeEach(() => {
    bridge = new AiTelemetryBridge();
    capturedAttributes = {};
    capturedEvents = [];

    mockSpan = {
      setAttribute: vi.fn((key: string, value: unknown) => {
        capturedAttributes[key] = value;
      }),
      addEvent: vi.fn((name: string, attributes: Record<string, unknown>) => {
        capturedEvents.push({ name, attributes: attributes ?? {} });
      }),
    };
  });

  describe("recordUsage", () => {
    it("should map AiUsageRecord to GenAI span attributes correctly", async () => {
      const usageRecord: AiUsageRecord = {
        inputTokens: 100,
        outputTokens: 50,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0.06,
        accuracy: "EXACT",
        idempotencyKey: "test-key-123",
        tenantId: "tenant-123",
        timestamp: new Date("2024-01-01T00:00:00Z"),
      };

      await bridge.recordUsage(usageRecord, mockSpan);

      expect(capturedAttributes["gen_ai.system"]).toBe("openai");
      expect(capturedAttributes["gen_ai.request.model"]).toBe("gpt-4");
      expect(capturedAttributes["gen_ai.usage.prompt_tokens"]).toBe(100);
      expect(capturedAttributes["gen_ai.usage.completion_tokens"]).toBe(50);
      expect(capturedAttributes["gen_ai.usage.cost_usd"]).toBe(0.06);
      expect(capturedAttributes["gen_ai.client.user"]).toBe("tenant-123");
      expect(capturedAttributes["gen_ai.usage.accuracy"]).toBe("EXACT");
    });

    it("should handle ESTIMATED accuracy correctly", async () => {
      const usageRecord: AiUsageRecord = {
        inputTokens: 200,
        outputTokens: 100,
        modelId: "claude-3-opus",
        provider: "anthropic",
        costUsd: 0.12,
        accuracy: "ESTIMATED",
        idempotencyKey: "estimated-key-456",
        tenantId: "tenant-456",
        timestamp: new Date(),
      };

      await bridge.recordUsage(usageRecord, mockSpan);

      expect(capturedAttributes["gen_ai.usage.accuracy"]).toBe("ESTIMATED");
      expect(capturedAttributes["gen_ai.system"]).toBe("anthropic");
      expect(capturedAttributes["gen_ai.request.model"]).toBe("claude-3-opus");
    });

    it("should handle usage record without accuracy field", async () => {
      const usageRecord: AiUsageRecord = {
        inputTokens: 50,
        outputTokens: 25,
        modelId: "gpt-3.5-turbo",
        provider: "openai",
        costUsd: 0.01,
        idempotencyKey: "no-accuracy-key-789",
        tenantId: "tenant-789",
        timestamp: new Date(),
      };

      await bridge.recordUsage(usageRecord, mockSpan);

      expect(capturedAttributes["gen_ai.usage.accuracy"]).toBeUndefined();
      expect(capturedAttributes["gen_ai.system"]).toBe("openai");
      expect(capturedAttributes["gen_ai.usage.prompt_tokens"]).toBe(50);
      expect(capturedAttributes["gen_ai.usage.completion_tokens"]).toBe(25);
    });

    it("should record ai-usage/usage event with metadata", async () => {
      const usageRecord: AiUsageRecord = {
        inputTokens: 100,
        outputTokens: 50,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0.06,
        idempotencyKey: "event-test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      await bridge.recordUsage(usageRecord, mockSpan);

      const usageEvent = capturedEvents.find((e) => e.name === "ai-usage/usage");
      expect(usageEvent).not.toBeUndefined();
      expect(usageEvent?.attributes).toMatchObject({
        provider: "openai",
        model: "gpt-4",
        tenantId: "tenant-123",
      });
    });
  });

  describe("mapToGenAiAttributes", () => {
    it("should return correct GenAI attributes mapping", () => {
      const usageRecord: AiUsageRecord = {
        inputTokens: 150,
        outputTokens: 75,
        modelId: "claude-3-sonnet",
        provider: "anthropic",
        costUsd: 0.08,
        accuracy: "EXACT",
        idempotencyKey: "mapping-test",
        tenantId: "tenant-mapping",
        timestamp: new Date(),
      };

      const attributes = bridge.mapToGenAiAttributes(usageRecord);

      expect(attributes).toEqual({
        "gen_ai.system": "anthropic",
        "gen_ai.request.model": "claude-3-sonnet",
        "gen_ai.usage.prompt_tokens": 150,
        "gen_ai.usage.completion_tokens": 75,
        "gen_ai.usage.cost_usd": 0.08,
        "gen_ai.client.user": "tenant-mapping",
        "gen_ai.usage.accuracy": "EXACT",
      });
    });

    it("should exclude accuracy when not present in usage record", () => {
      const usageRecord: AiUsageRecord = {
        inputTokens: 100,
        outputTokens: 50,
        modelId: "gpt-3.5-turbo",
        provider: "openai",
        costUsd: 0.02,
        idempotencyKey: "no-accuracy-mapping",
        tenantId: "tenant-no-accuracy",
        timestamp: new Date(),
      };

      const attributes = bridge.mapToGenAiAttributes(usageRecord);

      // accuracy 키가 존재하지 않아야 함
      expect(attributes["gen_ai.usage.accuracy"]).toBeUndefined();

      // 다른 필드들은 존재해야 함
      expect(attributes["gen_ai.system"]).toBe("openai");
      expect(attributes["gen_ai.usage.prompt_tokens"]).toBe(100);
    });
  });
});
