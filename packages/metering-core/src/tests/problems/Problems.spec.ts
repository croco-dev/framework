import { describe, expect, it } from "vitest";
import { AtomicQuotaNotSupportedProblem } from "../../libs/problems/AtomicQuotaNotSupportedProblem";
import { BillableUsageJournalRequiredProblem } from "../../libs/problems/BillableUsageJournalRequiredProblem";
import { DuplicateRecordProblem } from "../../libs/problems/DuplicateRecordProblem";
import { InvalidMeterProblem } from "../../libs/problems/InvalidMeterProblem";
import { InvalidUsageQueryProblem } from "../../libs/problems/InvalidUsageQueryProblem";
import { InvalidUsageValueProblem } from "../../libs/problems/InvalidUsageValueProblem";
import { MeteringTransitionProblem } from "../../libs/problems/MeteringTransitionProblem";
import { QuotaExceededProblem } from "../../libs/problems/QuotaExceededProblem";
import { RedisProblem } from "../../libs/problems/RedisProblem";

describe("Problems", () => {
  it("should expose a stable missing billable journal diagnostic", () => {
    const problem = new BillableUsageJournalRequiredProblem("ai.tokens");

    expect(problem).toMatchObject({
      code: "metering/billable-usage-journal-required",
      extensions: { meterId: "ai.tokens" },
    });
  });
  describe("QuotaExceededProblem", () => {
    it("should create with correct properties", () => {
      const problem = new QuotaExceededProblem("api_calls", 150, 100);

      expect(problem.code).toBe("metering/quota-exceeded");
      expect(problem.status).toBe(429);
      expect(problem.detail).toContain("Quota exceeded");
      expect(problem.detail).toContain("api_calls");

      const json = problem.toJSON();
      expect(json.meterId).toBe("api_calls");
      expect(json.currentUsage).toBe(150);
      expect(json.quota).toBe(100);
    });
  });

  describe("AtomicQuotaNotSupportedProblem", () => {
    it("should create with correct properties", () => {
      const problem = new AtomicQuotaNotSupportedProblem();

      expect(problem.code).toBe("metering/atomic-quota-not-supported");
      expect(problem.status).toBe(500);
      expect(problem.detail).toContain("atomic quota checks");
    });
  });

  describe("InvalidMeterProblem", () => {
    it("should create with correct properties", () => {
      const problem = new InvalidMeterProblem("unknown_meter", "tenant-1");

      expect(problem.code).toBe("metering/invalid-meter");
      expect(problem.status).toBe(404);
      expect(problem.detail).toContain("unknown_meter");
      expect(problem.detail).toContain("tenant-1");

      const json = problem.toJSON();
      expect(json.meterId).toBe("unknown_meter");
      expect(json.tenantId).toBe("tenant-1");
    });
  });

  describe("InvalidUsageQueryProblem", () => {
    it("should create a validation response with a stable reason", () => {
      const problem = new InvalidUsageQueryProblem("dates must be valid");

      expect(problem.code).toBe("metering/invalid-usage-query");
      expect(problem.status).toBe(422);
      expect(problem.detail).toContain("dates must be valid");
      expect(problem.toJSON().reason).toBe("dates must be valid");
    });
  });

  describe("InvalidUsageValueProblem", () => {
    it("should expose a stable validation contract", () => {
      const problem = new InvalidUsageValueProblem(1.9);

      expect(problem.code).toBe("metering/invalid-usage-value");
      expect(problem.status).toBe(422);
      expect(problem.detail).toContain("between 1 and 2147483647");
      expect(problem.toJSON()).toMatchObject({
        receivedValue: "1.9",
        reason: "value must be an integer between 1 and 2147483647",
      });
    });
  });

  describe("DuplicateRecordProblem", () => {
    it("should create with correct properties", () => {
      const problem = new DuplicateRecordProblem("idem-key-123");

      expect(problem.code).toBe("metering/duplicate-record");
      expect(problem.status).toBe(409);
      expect(problem.detail).toContain("idem-key-123");

      const json = problem.toJSON();
      expect(json.idempotencyKey).toBe("idem-key-123");
    });
  });

  describe("MeteringTransitionProblem", () => {
    it("should expose stable transition failure evidence", () => {
      const problem = new MeteringTransitionProblem("release-events", "TOKEN", "idem-key-123");

      expect(problem.code).toBe("metering/transition-conflict");
      expect(problem.status).toBe(409);
      expect(problem.toJSON()).toMatchObject({
        idempotencyKey: "idem-key-123",
        reason: "TOKEN",
        transition: "release-events",
      });
    });
  });

  describe("RedisProblem", () => {
    it("should create with original error", () => {
      const originalError = new Error("Connection refused");
      const problem = new RedisProblem("ZADD", originalError);

      expect(problem.code).toBe("metering/redis-error");
      expect(problem.status).toBe(500);
      expect(problem.detail).toContain("ZADD");
      expect(problem.detail).toContain("Connection refused");

      const json = problem.toJSON();
      expect(json.operation).toBe("ZADD");
      expect(json.originalMessage).toBe("Connection refused");
    });

    it("should handle missing original error", () => {
      const problem = new RedisProblem("SET");

      expect(problem.detail).toContain("Unknown error");
    });

    it("should create with deterministic response diagnostics", () => {
      const problem = new RedisProblem(
        "ZRANGEBYSCORE",
        "WITHSCORES returned an odd number of values",
      );

      expect(problem.code).toBe("metering/redis-error");
      expect(problem.detail).toContain("WITHSCORES returned an odd number of values");
      expect(problem.toJSON().originalMessage).toBe("WITHSCORES returned an odd number of values");
    });
  });
});
