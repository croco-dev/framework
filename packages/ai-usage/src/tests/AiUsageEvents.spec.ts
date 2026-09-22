import { describe, expect, it } from "vitest";
import { AiCostBudgetExceededEvent } from "../libs/events/AiCostBudgetExceededEvent";
import { AiUsageRecordedEvent } from "../libs/events/AiUsageRecordedEvent";
import type { AiUsageRecord } from "../libs/types";

describe("Events", () => {
  describe("AiUsageRecordedEvent", () => {
    it("should create event with usage record", () => {
      const usage: AiUsageRecord = {
        inputTokens: 100,
        outputTokens: 50,
        modelId: "gpt-4",
        provider: "openai",
        costUsd: 0.003,
        idempotencyKey: "test-key",
        tenantId: "tenant-123",
        timestamp: new Date(),
      };

      const event = new AiUsageRecordedEvent("tenant-123", usage);

      expect(event.tenantId).toBe("tenant-123");
      expect(event.usage).toEqual(usage);
    });
  });

  describe("AiCostBudgetExceededEvent", () => {
    it("should create event for daily limit exceeded", () => {
      const event = new AiCostBudgetExceededEvent("tenant-123", 15.0, 10.0, "daily");

      expect(event.tenantId).toBe("tenant-123");
      expect(event.currentCost).toBe(15.0);
      expect(event.limit).toBe(10.0);
      expect(event.period).toBe("daily");
    });

    it("should create event for monthly limit exceeded", () => {
      const event = new AiCostBudgetExceededEvent("tenant-123", 150.0, 100.0, "monthly");

      expect(event.tenantId).toBe("tenant-123");
      expect(event.currentCost).toBe(150.0);
      expect(event.limit).toBe(100.0);
      expect(event.period).toBe("monthly");
    });
  });
});
