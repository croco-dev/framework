import { describe, expect, it } from "vitest";
import { QuotaExceededEvent } from "../../libs/events/QuotaExceededEvent";
import { UsageRecordedEvent } from "../../libs/events/UsageRecordedEvent";

describe("Events", () => {
  describe("UsageRecordedEvent", () => {
    it("should create with correct properties", () => {
      const event = new UsageRecordedEvent("tenant-1", "api_calls", 5, "idem-key-123", {
        userId: "user-1",
      });

      expect(event.tenantId).toBe("tenant-1");
      expect(event.meterId).toBe("api_calls");
      expect(event.value).toBe(5);
      expect(event.idempotencyKey).toBe("idem-key-123");
      expect(event.metadata?.userId).toBe("user-1");
    });

    it("should set eventName automatically", () => {
      const event = new UsageRecordedEvent("tenant-1", "api_calls", 1, "key-1");

      expect(event.eventName).toBe("metering.usage_recorded");
    });

    it("should set timestamp automatically", () => {
      const before = new Date();
      const event = new UsageRecordedEvent("tenant-1", "api_calls", 1, "key-1");
      const after = new Date();

      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should work without metadata", () => {
      const event = new UsageRecordedEvent("tenant-1", "api_calls", 1, "key-1");

      expect(event.metadata).toBeUndefined();
    });

    it("should derive a stable logical identity from the idempotency key", () => {
      const longKey = "sensitive-key".repeat(100);
      const first = new UsageRecordedEvent("tenant-1", "api_calls", 1, longKey);
      const retry = new UsageRecordedEvent("tenant-1", "api_calls", 1, longKey);
      const other = new UsageRecordedEvent("tenant-1", "api_calls", 1, "key-2");

      expect(retry.eventId).toBe(first.eventId);
      expect(other.eventId).not.toBe(first.eventId);
      expect(first.eventId).toMatch(/^[a-f0-9]{64}$/);
      expect(first.eventId).not.toContain("sensitive-key");
    });

    it("should distinguish a new operation after the idempotency window", () => {
      const first = new UsageRecordedEvent(
        "tenant-1",
        "api_calls",
        1,
        "reused-key",
        undefined,
        "operation-1",
      );
      const retry = new UsageRecordedEvent(
        "tenant-1",
        "api_calls",
        1,
        "reused-key",
        undefined,
        "operation-1",
      );
      const laterOperation = new UsageRecordedEvent(
        "tenant-1",
        "api_calls",
        1,
        "reused-key",
        undefined,
        "operation-2",
      );

      expect(retry.eventId).toBe(first.eventId);
      expect(laterOperation.eventId).toBe(first.eventId);
    });
  });

  describe("QuotaExceededEvent", () => {
    it("should create with correct properties", () => {
      const event = new QuotaExceededEvent("tenant-1", "api_calls", 150, 100);

      expect(event.tenantId).toBe("tenant-1");
      expect(event.meterId).toBe("api_calls");
      expect(event.currentUsage).toBe(150);
      expect(event.quota).toBe(100);
    });

    it("should set eventName automatically", () => {
      const event = new QuotaExceededEvent("tenant-1", "api_calls", 150, 100);

      expect(event.eventName).toBe("metering.quota_exceeded");
    });

    it("should set timestamp automatically", () => {
      const before = new Date();
      const event = new QuotaExceededEvent("tenant-1", "api_calls", 150, 100);
      const after = new Date();

      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should derive a stable logical identity when an idempotency key is provided", () => {
      const longKey = "sensitive-key".repeat(100);
      const first = new QuotaExceededEvent(
        "tenant-1",
        "api_calls",
        150,
        100,
        longKey,
        "operation-1",
      );
      const retry = new QuotaExceededEvent(
        "tenant-1",
        "api_calls",
        150,
        100,
        longKey,
        "operation-1",
      );
      const laterOperation = new QuotaExceededEvent(
        "tenant-1",
        "api_calls",
        150,
        100,
        longKey,
        "operation-2",
      );
      const other = new QuotaExceededEvent("tenant-1", "api_calls", 150, 100, "key-2");

      expect(retry.eventId).toBe(first.eventId);
      expect(laterOperation.eventId).toBe(first.eventId);
      expect(other.eventId).not.toBe(first.eventId);
      expect(first.eventId).toMatch(/^[a-f0-9]{64}$/);
      expect(first.eventId).not.toContain("sensitive-key");
    });
  });
});
