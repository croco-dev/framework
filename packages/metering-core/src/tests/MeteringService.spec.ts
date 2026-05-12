import type { EventBus } from "@croco/events-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuotaExceededEvent } from "../libs/events/QuotaExceededEvent";
import { UsageRecordedEvent } from "../libs/events/UsageRecordedEvent";
import type { IdempotencyManager } from "../libs/IdempotencyManager";
import { MeteringService } from "../libs/MeteringService";
import type { MeterRegistry } from "../libs/MeterRegistry";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import { InvalidMeterProblem } from "../libs/problems/InvalidMeterProblem";
import { QuotaExceededProblem } from "../libs/problems/QuotaExceededProblem";
import type { MeterDefinition } from "../libs/types";
import type { UsageStorage } from "../libs/UsageStorage";

describe("MeteringService", () => {
  let service!: MeteringService;
  let mockRegistry!: MeterRegistry;
  let mockStorage!: UsageStorage;
  let mockIdempotency!: IdempotencyManager;
  let mockEventBus!: EventBus;

  const createMeter = (overrides: Partial<MeterDefinition> = {}): MeterDefinition => ({
    id: "meter-123",
    tenantId: "tenant-1",
    meterId: "api_calls",
    type: "COUNT",
    quota: 1000,
    allowOverQuota: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockRegistry = {
      loadAll: vi.fn(),
      get: vi.fn(),
      getOrThrow: vi.fn(),
      register: vi.fn(),
      getByTenant: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as MeterRegistry;

    mockStorage = {
      record: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn().mockResolvedValue(0),
      isIdempotent: vi.fn().mockResolvedValue(true),
      fetchUsageRecords: vi.fn().mockResolvedValue([]),
      checkAndRecordWithinQuota: vi.fn().mockResolvedValue({ exceeded: false, newUsage: 5 }),
    };

    mockIdempotency = {
      ensureIdempotencyKey: vi.fn().mockReturnValue("generated-key"),
      checkAndMark: vi.fn().mockResolvedValue(true),
      checkAndMarkOrThrow: vi.fn().mockResolvedValue(undefined),
      beginProcessing: vi.fn().mockResolvedValue(true),
      beginProcessingOrThrow: vi.fn().mockResolvedValue(undefined),
      completeProcessing: vi.fn().mockResolvedValue(undefined),
      abortProcessing: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyManager;

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    } as unknown as EventBus;

    service = new MeteringService({
      meterRegistry: mockRegistry,
      usageStorage: mockStorage,
      idempotencyManager: mockIdempotency,
      eventBus: mockEventBus,
    });
  });

  describe("record", () => {
    it("should record usage successfully", async () => {
      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
      });

      expect(result.tenantId).toBe("tenant-1");
      expect(result.meterId).toBe("api_calls");
      expect(result.value).toBe(5);
      expect(result.idempotencyKey).toBe("generated-key");
      expect(mockIdempotency.beginProcessingOrThrow).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
      );
      expect(mockIdempotency.completeProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
      );
      expect(mockStorage.checkAndRecordWithinQuota).toHaveBeenCalledTimes(1);
    });

    it("should use default value of 1", async () => {
      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
      });

      expect(result.value).toBe(1);
    });

    it("should use provided idempotency key", async () => {
      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockReturnValue("custom-key");

      await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        idempotencyKey: "custom-key",
      });

      expect(mockIdempotency.ensureIdempotencyKey).toHaveBeenCalledWith("custom-key");
    });

    it("should throw InvalidMeterProblem for unknown meter", async () => {
      vi.mocked(mockRegistry.getOrThrow).mockRejectedValue(
        new InvalidMeterProblem("unknown", "tenant-1"),
      );

      await expect(service.record({ tenantId: "tenant-1", meterId: "unknown" })).rejects.toThrow(
        InvalidMeterProblem,
      );
    });

    it("should throw DuplicateRecordProblem for duplicate key", async () => {
      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(mockIdempotency.beginProcessingOrThrow).mockRejectedValue(
        new DuplicateRecordProblem("dup-key"),
      );

      await expect(service.record({ tenantId: "tenant-1", meterId: "api_calls" })).rejects.toThrow(
        DuplicateRecordProblem,
      );
    });

    it("should throw QuotaExceededProblem when quota exceeded and allowOverQuota is false", async () => {
      const meter = createMeter({ quota: 100, allowOverQuota: false });
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;

      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({ exceeded: true, newUsage: 104 });

      await expect(
        service.record({ tenantId: "tenant-1", meterId: "api_calls", value: 5 }),
      ).rejects.toThrow(QuotaExceededProblem);

      expect(mockIdempotency.completeProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
      );
      expect(mockIdempotency.abortProcessing).not.toHaveBeenCalled();
    });

    it("BUG-11 동시 할당량 소진에서 atomic storage 결과를 그대로 반영한다", async () => {
      const meter = createMeter({ quota: 10, allowOverQuota: false });
      let invocationCount = 0;
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;

      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(checkAndRecordWithinQuota).mockImplementation(async () => {
        invocationCount += 1;

        if (invocationCount <= 2) {
          return { exceeded: false, newUsage: invocationCount * 4 };
        }

        return { exceeded: true, newUsage: 12 };
      });

      const first = service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 4,
        idempotencyKey: "bug-11-first",
      });
      const second = service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 4,
        idempotencyKey: "bug-11-second",
      });
      const third = service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 4,
        idempotencyKey: "bug-11-third",
      });

      const settled = await Promise.allSettled([first, second, third]);
      const successCount = settled.filter((result) => result.status === "fulfilled").length;
      const failedResults = settled.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      const firstFailedResult = failedResults[0];

      if (!firstFailedResult) {
        throw new Error("Expected one rejected result");
      }

      expect(successCount).toBe(2);
      expect(failedResults).toHaveLength(1);
      expect(firstFailedResult.reason).toBeInstanceOf(QuotaExceededProblem);
      expect(checkAndRecordWithinQuota).toHaveBeenCalledTimes(3);
    });

    it("should allow over quota when allowOverQuota is true", async () => {
      const meter = createMeter({ quota: 100, allowOverQuota: true });
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;

      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({ exceeded: true, newUsage: 104 });

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
      });

      expect(result.value).toBe(5);
    });

    it("should skip quota check when no quota defined", async () => {
      const meter = createMeter({ quota: undefined });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 1000000,
      });

      expect(result.value).toBe(1000000);
      expect(mockIdempotency.completeProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
      );
    });

    it("should abort in-progress idempotency key when storage fails before completion", async () => {
      const meter = createMeter({ quota: undefined });
      const storageError = new Error("storage failure");

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(mockStorage.record).mockRejectedValue(storageError);

      await expect(service.record({ tenantId: "tenant-1", meterId: "api_calls" })).rejects.toThrow(
        storageError,
      );

      expect(mockIdempotency.abortProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
      );
      expect(mockIdempotency.completeProcessing).not.toHaveBeenCalled();
    });

    it("should publish UsageRecordedEvent", async () => {
      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);

      await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        metadata: { userId: "user-1" },
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(UsageRecordedEvent));
    });

    it("should publish QuotaExceededEvent when quota exceeded", async () => {
      const meter = createMeter({ quota: 100, allowOverQuota: true });
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;

      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({ exceeded: true, newUsage: 104 });

      await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(QuotaExceededEvent));
    });

    it("should work without eventBus", async () => {
      const serviceWithoutEventBus = new MeteringService({
        meterRegistry: mockRegistry,
        usageStorage: mockStorage,
        idempotencyManager: mockIdempotency,
      });

      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);

      const result = await serviceWithoutEventBus.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
      });

      expect(result.value).toBe(1);
    });

    it("should include metadata in usage record", async () => {
      const meter = createMeter();
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        metadata: { userId: "user-1", action: "create" },
      });

      expect(result.metadata).toEqual({ userId: "user-1", action: "create" });
    });

    it("BUG-12 publish 실패 후 retry 시 재진입 가능해야 한다 - quota branch", async () => {
      const meter = createMeter({ quota: 100, allowOverQuota: true });
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;

      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({ exceeded: true, newUsage: 50 });
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockImplementation(
        (key?: string) => key ?? "generated-key",
      );

      let firstCall = true;
      vi.mocked(mockEventBus.publish).mockImplementation(async () => {
        if (firstCall) {
          firstCall = false;
          throw new Error("publish failure");
        }
      });

      await expect(
        service.record({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          idempotencyKey: "idem-publish-fail-quota",
        }),
      ).rejects.toThrow("publish failure");

      vi.mocked(mockIdempotency.beginProcessing).mockResolvedValueOnce(false);

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        idempotencyKey: "idem-publish-fail-quota",
      });

      expect(result).toBeDefined();
      expect(result.idempotencyKey).toBe("idem-publish-fail-quota");
    });

    it("BUG-12 publish 실패 후 retry 시 재진입 가능해야 한다 - non-quota branch", async () => {
      const meter = createMeter({ quota: undefined });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockImplementation(
        (key?: string) => key ?? "generated-key",
      );

      let firstCall = true;
      vi.mocked(mockEventBus.publish).mockImplementation(async () => {
        if (firstCall) {
          firstCall = false;
          throw new Error("publish failure");
        }
      });

      await expect(
        service.record({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 1,
          idempotencyKey: "idem-publish-fail-non-quota",
        }),
      ).rejects.toThrow("publish failure");

      vi.mocked(mockIdempotency.beginProcessing).mockResolvedValueOnce(false);

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 1,
        idempotencyKey: "idem-publish-fail-non-quota",
      });

      expect(result).toBeDefined();
      expect(result.idempotencyKey).toBe("idem-publish-fail-non-quota");
    });
  });

  describe("getUsage", () => {
    it("should return usage from storage", async () => {
      vi.mocked(mockStorage.getUsage).mockResolvedValue(150);

      const result = await service.getUsage({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "billing_cycle",
      });

      expect(result).toBe(150);
      expect(mockStorage.getUsage).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "billing_cycle",
      });
    });

    it("should pass date range to storage", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      await service.getUsage({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate,
        endDate,
      });

      expect(mockStorage.getUsage).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        meterId: "api_calls",
        period: "day",
        startDate,
        endDate,
      });
    });
  });
});
