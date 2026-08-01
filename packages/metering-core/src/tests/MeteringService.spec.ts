import type { EventBus } from "@croco/events-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryBillableUsageJournal,
  type BillableUsageJournal,
} from "../libs/BillableUsageJournal";
import { QuotaExceededEvent } from "../libs/events/QuotaExceededEvent";
import { UsageRecordedEvent } from "../libs/events/UsageRecordedEvent";
import type {
  IdempotencyClaim,
  IdempotencyManager,
  PendingMeteringDelivery,
} from "../libs/IdempotencyManager";
import { MeteringService } from "../libs/MeteringService";
import type { MeterRecordInput } from "../libs/MeterRef";
import { defineMeter, dimension } from "../libs/MeterRef";
import type { MeterRegistry } from "../libs/MeterRegistry";
import { DuplicateRecordProblem } from "../libs/problems/DuplicateRecordProblem";
import { InvalidMeterProblem } from "../libs/problems/InvalidMeterProblem";
import { InvalidUsageEnvelopeProblem } from "../libs/problems/InvalidUsageEnvelopeProblem";
import { QuotaExceededProblem } from "../libs/problems/QuotaExceededProblem";
import type { MeterDefinition } from "../libs/types";
import type { UsageStorage } from "../libs/UsageStorage";

function asPersistentJournal(
  journal: InMemoryBillableUsageJournal,
  overrides: Partial<BillableUsageJournal> = {},
): BillableUsageJournal {
  return {
    durability: "persistent",
    append: journal.append.bind(journal),
    markDeliverable: journal.markDeliverable.bind(journal),
    markUndeliverable: journal.markUndeliverable.bind(journal),
    claimNext: journal.claimNext.bind(journal),
    markAccepted: journal.markAccepted.bind(journal),
    markRetryableFailed: journal.markRetryableFailed.bind(journal),
    markTerminalFailed: journal.markTerminalFailed.bind(journal),
    get: journal.get.bind(journal),
    getDiagnostics: journal.getDiagnostics.bind(journal),
    ...overrides,
  };
}

describe("MeteringService", () => {
  let service!: MeteringService;
  let mockRegistry!: MeterRegistry;
  let mockStorage!: UsageStorage;
  let mockIdempotency!: IdempotencyManager;
  let mockEventBus!: EventBus;
  let mockJournal!: BillableUsageJournal;

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
      replayContract: "idempotent",
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
      claimMeteringProcessingOrThrow: vi
        .fn()
        .mockResolvedValue({ operationId: "operation-id", token: "claim-token" }),
      markMeteringEventsPublishing: vi.fn().mockResolvedValue(undefined),
      releaseMeteringProcessing: vi.fn().mockResolvedValue(undefined),
      releaseMeteringEvents: vi.fn().mockResolvedValue(undefined),
      completeMeteringProcessing: vi.fn().mockResolvedValue(undefined),
      abortMeteringProcessing: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyManager;

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    } as unknown as EventBus;

    mockJournal = {
      durability: "persistent",
      append: vi.fn().mockImplementation(async (event) => ({
        outcome: "appended",
        entry: {
          event,
          state: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
          retryCount: 0,
        },
      })),
      markDeliverable: vi.fn(),
      markUndeliverable: vi.fn(),
      claimNext: vi.fn(),
      markAccepted: vi.fn(),
      markRetryableFailed: vi.fn(),
      markTerminalFailed: vi.fn(),
      get: vi.fn(),
      getDiagnostics: vi.fn().mockResolvedValue({
        backlogCount: 0,
        oldestPendingAgeMs: null,
        retryCount: 0,
        terminalFailureCount: 0,
      }),
    } as unknown as BillableUsageJournal;
    mockRegistry = { ...mockRegistry, billableUsageJournal: mockJournal } as MeterRegistry;

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
      expect(mockIdempotency.claimMeteringProcessingOrThrow).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
      );
      expect(mockIdempotency.completeMeteringProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
        "claim-token",
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

    it("should record a typed billable usage envelope with separate dimensions and metadata", async () => {
      const meterRef = defineMeter({
        key: "ai.tokens",
        aggregation: "SUM",
        unit: "token",
        dimensions: {
          model: dimension.enum(["gpt-5", "gpt-5-mini"]),
        },
        billing: "required",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "ai.tokens", quota: undefined }),
      );
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockReturnValue("request-1");

      const result = await service.record(meterRef, {
        tenantId: "tenant-1",
        eventId: "request-1",
        value: 42,
        dimensions: { model: "gpt-5" },
        metadata: { route: "/generate" },
      });

      expect(mockRegistry.getOrThrow).toHaveBeenCalledWith("tenant-1", "ai.tokens");
      expect(mockIdempotency.ensureIdempotencyKey).toHaveBeenCalledWith("request-1");
      expect(result).toEqual(
        expect.objectContaining({
          meterId: "ai.tokens",
          value: 42,
          eventId: "request-1",
          dimensions: { model: "gpt-5" },
          metadata: { route: "/generate" },
        }),
      );
      expect(result.dimensions).not.toBe(result.metadata);
      expect(mockJournal.append).toHaveBeenCalledWith({
        eventId: "request-1",
        tenantId: "tenant-1",
        meterId: "ai.tokens",
        aggregation: "SUM",
        unit: "token",
        value: 42,
        dimensions: { model: "gpt-5" },
      });
    });

    it("should use the normalized billing event identity consistently", async () => {
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", quota: undefined }),
      );
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockReturnValue("request-1");

      const result = await service.record(meterRef, {
        tenantId: "tenant-1",
        eventId: "  request-1  ",
      });

      expect(mockIdempotency.ensureIdempotencyKey).toHaveBeenCalledWith("request-1");
      expect(result).toEqual(
        expect.objectContaining({
          idempotencyKey: "request-1",
          eventId: "request-1",
        }),
      );
    });

    it("should not let a typed local descriptor downgrade a registered required meter", async () => {
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", billing: "required", quota: undefined }),
      );

      await service.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" });

      expect(mockJournal.append).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "event-1", meterId: "billable.calls" }),
      );
    });

    it("should reject a registered required meter without a caller-stable identity", async () => {
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", billing: "required", quota: undefined }),
      );

      await expect(
        service.record({ tenantId: "tenant-1", meterId: "billable.calls" }),
      ).rejects.toMatchObject({
        code: "metering/invalid-usage-envelope",
        extensions: {
          reason: "billing-required meters require a caller-supplied eventId or idempotencyKey",
        },
      });
      expect(mockIdempotency.abortMeteringProcessing).toHaveBeenCalledTimes(1);
      expect(mockJournal.append).not.toHaveBeenCalled();
    });

    it("should use a legacy idempotency key as the stable billable event identity", async () => {
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", billing: "required", quota: undefined }),
      );
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockReturnValue("request-1");

      await service.record({
        tenantId: "tenant-1",
        meterId: "billable.calls",
        idempotencyKey: "  request-1  ",
      });

      expect(mockIdempotency.ensureIdempotencyKey).toHaveBeenCalledWith("request-1");
      expect(mockIdempotency.claimMeteringProcessingOrThrow).toHaveBeenCalledWith(
        "tenant-1",
        "billable.calls",
        "request-1",
      );
      expect(mockJournal.append).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "request-1", meterId: "billable.calls" }),
      );
    });

    it("should ignore a blank legacy eventId when a stable idempotency key is available", async () => {
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", billing: "required", quota: undefined }),
      );
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockReturnValue("request-1");

      const options = {
        tenantId: "tenant-1",
        meterId: "billable.calls",
        eventId: "   ",
        idempotencyKey: " request-1 ",
      };

      await service.record(options);

      expect(mockJournal.append).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: "request-1", meterId: "billable.calls" }),
      );
    });

    it("should reject typed aggregation or unit drift from the registered contract", async () => {
      const meterRef = defineMeter({
        key: "ai.tokens",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({
          meterId: "ai.tokens",
          billing: "required",
          aggregation: "SUM",
          unit: "token",
          quota: undefined,
        }),
      );

      await expect(
        service.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" }),
      ).rejects.toMatchObject({
        code: "metering/invalid-usage-envelope",
        extensions: { reason: "aggregation 'COUNT' does not match registered 'SUM'" },
      });
      expect(mockJournal.append).not.toHaveBeenCalled();
    });

    it("should generate an identity for a blank optional eventId", async () => {
      const meterRef = defineMeter({
        key: "local.calls",
        aggregation: "COUNT",
        unit: "request",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "local.calls", quota: undefined }),
      );

      const result = await service.record(meterRef, {
        tenantId: "tenant-1",
        eventId: "   ",
      });

      expect(mockIdempotency.ensureIdempotencyKey).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(
        expect.objectContaining({
          idempotencyKey: "generated-key",
          eventId: undefined,
        }),
      );
    });

    it("should snapshot validated dimensions before recording", async () => {
      const meterRef = defineMeter({
        key: "regional.calls",
        aggregation: "COUNT",
        unit: "request",
        dimensions: {
          region: dimension.enum(["ap-northeast-2", "us-east-1"]),
        },
      });
      const dimensions: { region: "ap-northeast-2" | "us-east-1" } = {
        region: "ap-northeast-2",
      };
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "regional.calls", quota: undefined }),
      );

      const result = await service.record(meterRef, {
        tenantId: "tenant-1",
        dimensions,
      });
      dimensions.region = "us-east-1";

      expect(result.dimensions).toEqual({ region: "ap-northeast-2" });
      expect(result.dimensions).not.toBe(dimensions);
    });

    it("should reject billing-required usage without a stable eventId at runtime", async () => {
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      const invalidInput = {
        tenantId: "tenant-1",
      } as unknown as MeterRecordInput<typeof meterRef>;

      await expect(service.record(meterRef, invalidInput)).rejects.toBeInstanceOf(
        InvalidUsageEnvelopeProblem,
      );
      expect(mockRegistry.getOrThrow).not.toHaveBeenCalled();
    });

    it("should reject billable usage when no persistent journal is configured", async () => {
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      const serviceWithoutJournal = new MeteringService({
        meterRegistry: { ...mockRegistry, billableUsageJournal: undefined } as MeterRegistry,
        usageStorage: mockStorage,
        idempotencyManager: mockIdempotency,
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", quota: undefined }),
      );

      await expect(
        serviceWithoutJournal.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" }),
      ).rejects.toMatchObject({ code: "metering/billable-usage-journal-required" });
      expect(mockStorage.record).not.toHaveBeenCalled();
    });

    it("should leave a replayable intent when local persistence fails after append", async () => {
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", quota: undefined }),
      );
      vi.mocked(mockStorage.record).mockRejectedValue(new Error("process terminated"));

      await expect(
        service.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" }),
      ).rejects.toThrow("process terminated");
      expect(mockJournal.append).toHaveBeenCalledBefore(vi.mocked(mockStorage.record));
    });

    it("should retain a pending intent after local commit and process loss", async () => {
      const memoryJournal = new InMemoryBillableUsageJournal();
      const persistentJournal = asPersistentJournal(memoryJournal);
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      const processLossService = new MeteringService({
        meterRegistry: {
          ...mockRegistry,
          billableUsageJournal: persistentJournal,
        } as MeterRegistry,
        usageStorage: mockStorage,
        idempotencyManager: mockIdempotency,
        eventBus: mockEventBus,
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", quota: undefined }),
      );
      vi.mocked(mockEventBus.publish).mockRejectedValue(new Error("process terminated"));

      await expect(
        processLossService.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" }),
      ).rejects.toThrow("process terminated");

      expect(mockStorage.record).toHaveBeenCalledTimes(1);
      expect(await persistentJournal.get("event-1")).toMatchObject({ state: "pending" });
      expect((await persistentJournal.getDiagnostics()).backlogCount).toBe(1);
    });

    it("should activate an existing intent when replay closes the local-commit gap", async () => {
      const memoryJournal = new InMemoryBillableUsageJournal();
      const markDeliverable = vi
        .fn()
        .mockRejectedValueOnce(new Error("process terminated before activation"))
        .mockImplementation(memoryJournal.markDeliverable.bind(memoryJournal));
      const persistentJournal = asPersistentJournal(memoryJournal, { markDeliverable });
      const persistedIds = new Set<string>();
      vi.mocked(mockStorage.record).mockImplementation(async (record) => {
        persistedIds.add(record.id);
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "billable.calls", billing: "required", quota: undefined }),
      );
      const replayService = new MeteringService({
        meterRegistry: {
          ...mockRegistry,
          billableUsageJournal: persistentJournal,
        } as MeterRegistry,
        usageStorage: mockStorage,
        idempotencyManager: mockIdempotency,
      });
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });

      await expect(
        replayService.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" }),
      ).rejects.toThrow("process terminated before activation");
      await expect(
        replayService.record(meterRef, { tenantId: "tenant-1", eventId: "event-1" }),
      ).resolves.toMatchObject({ eventId: "event-1" });

      expect(persistedIds).toEqual(new Set(["operation-id"]));
      expect(markDeliverable).toHaveBeenCalledTimes(2);
      await expect(
        persistentJournal.claimNext({ ownerId: "worker-1", leaseDurationMs: 1_000 }),
      ).resolves.toMatchObject({ state: "delivering" });
    });

    it("should reject non-string event identities as a modeled Problem", async () => {
      const meterRef = defineMeter({
        key: "billable.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });
      const invalidInput = {
        tenantId: "tenant-1",
        eventId: 42,
      } as unknown as MeterRecordInput<typeof meterRef>;

      await expect(service.record(meterRef, invalidInput)).rejects.toMatchObject({
        code: "metering/invalid-usage-envelope",
        extensions: {
          meterKey: "billable.calls",
          reason: "eventId must be a string",
        },
      });
      expect(mockRegistry.getOrThrow).not.toHaveBeenCalled();
    });

    it("should reject missing, extra, and invalid dimensions at runtime", async () => {
      const meterRef = defineMeter({
        key: "ai.tokens",
        aggregation: "SUM",
        unit: "token",
        dimensions: {
          model: dimension.enum(["gpt-5", "gpt-5-mini"]),
        },
      });
      const invalidDimensions = [undefined, { region: "us" }, { model: "gpt-4" }];

      for (const dimensions of invalidDimensions) {
        const invalidInput = {
          tenantId: "tenant-1",
          value: 1,
          dimensions,
        } as unknown as MeterRecordInput<typeof meterRef>;

        await expect(service.record(meterRef, invalidInput)).rejects.toBeInstanceOf(
          InvalidUsageEnvelopeProblem,
        );
      }
      expect(mockRegistry.getOrThrow).not.toHaveBeenCalled();
    });

    it("should preserve generated idempotency keys for local typed meters", async () => {
      const meterRef = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
      });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ meterId: "api.calls", quota: undefined }),
      );

      const result = await service.record(meterRef, {
        tenantId: "tenant-1",
      });

      expect(mockIdempotency.ensureIdempotencyKey).toHaveBeenCalledWith(undefined);
      expect(result.idempotencyKey).toBe("generated-key");
      expect(result.value).toBe(1);
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
      vi.mocked(mockIdempotency.claimMeteringProcessingOrThrow).mockRejectedValue(
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
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({
        exceeded: true,
        newUsage: 104,
      });

      await expect(
        service.record({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
        }),
      ).rejects.toThrow(QuotaExceededProblem);

      expect(mockIdempotency.completeMeteringProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
        "claim-token",
      );
      expect(mockIdempotency.abortMeteringProcessing).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringEvents).not.toHaveBeenCalled();
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
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({
        exceeded: true,
        newUsage: 104,
      });

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
      expect(mockIdempotency.completeMeteringProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
        "claim-token",
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

      expect(mockIdempotency.abortMeteringProcessing).toHaveBeenCalledWith(
        "tenant-1",
        "api_calls",
        "generated-key",
        "claim-token",
      );
      expect(mockIdempotency.completeMeteringProcessing).not.toHaveBeenCalled();
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
      vi.mocked(checkAndRecordWithinQuota).mockResolvedValue({
        exceeded: true,
        newUsage: 104,
      });

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

    it("should release non-quota processing state when delivery staging fails after persistence", async () => {
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(createMeter({ quota: undefined }));
      vi.mocked(mockIdempotency.markMeteringEventsPublishing)
        .mockRejectedValueOnce(new Error("staging unavailable"))
        .mockResolvedValueOnce(undefined);
      const persistedOperations = new Set<string>();
      let recordCallCount = 0;
      vi.mocked(mockStorage.record).mockImplementation(async (usage) => {
        recordCallCount += 1;
        persistedOperations.add(usage.idempotencyKey);
      });

      await expect(
        service.record({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          idempotencyKey: "staging-failure",
        }),
      ).rejects.toThrow("staging unavailable");

      expect(mockStorage.record).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.abortMeteringProcessing).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringEvents).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringProcessing).toHaveBeenCalledTimes(1);

      const recovered = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 5,
        idempotencyKey: "staging-failure",
      });

      expect(recovered.value).toBe(5);
      expect(persistedOperations.size).toBe(1);
      expect(recordCallCount).toBe(2);
      expect(mockStorage.record).toHaveBeenCalledTimes(2);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it("should release quota processing state when delivery staging fails after persistence", async () => {
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;
      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(
        createMeter({ quota: 100, allowOverQuota: false }),
      );
      const persistedOperations = new Map<string, { exceeded: boolean; newUsage: number }>();
      let quotaCallCount = 0;
      vi.mocked(checkAndRecordWithinQuota).mockImplementation(async ({ usageRecord }) => {
        quotaCallCount += 1;
        const persisted = persistedOperations.get(usageRecord.idempotencyKey);
        if (persisted) {
          return persisted;
        }
        const result = {
          exceeded: true,
          newUsage: 105,
        };
        persistedOperations.set(usageRecord.idempotencyKey, result);
        return result;
      });
      vi.mocked(mockIdempotency.markMeteringEventsPublishing)
        .mockRejectedValueOnce(new Error("staging unavailable"))
        .mockResolvedValueOnce(undefined);

      await expect(
        service.record({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          idempotencyKey: "quota-staging-failure",
        }),
      ).rejects.toThrow("staging unavailable");

      expect(checkAndRecordWithinQuota).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.abortMeteringProcessing).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringEvents).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringProcessing).toHaveBeenCalledTimes(1);

      await expect(
        service.record({
          tenantId: "tenant-1",
          meterId: "api_calls",
          value: 5,
          idempotencyKey: "quota-staging-failure",
        }),
      ).rejects.toMatchObject({ code: "metering/quota-exceeded" });

      expect(persistedOperations.size).toBe(1);
      expect(quotaCallCount).toBe(2);
      expect(checkAndRecordWithinQuota).toHaveBeenCalledTimes(2);
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it("should recover quota event publication without duplicating usage", async () => {
      const meter = createMeter({ quota: 100, allowOverQuota: true });
      const checkAndRecordWithinQuota = mockStorage.checkAndRecordWithinQuota;

      if (!checkAndRecordWithinQuota) {
        throw new Error("Expected atomic quota check support");
      }

      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      const recordedKeys = new Set<string>();
      let quotaCallCount = 0;
      vi.mocked(checkAndRecordWithinQuota).mockImplementation(async ({ usageRecord }) => {
        quotaCallCount += 1;
        recordedKeys.add(usageRecord.idempotencyKey);
        return {
          exceeded: true,
          newUsage: 105,
        };
      });
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockImplementation(
        (key?: string) => key ?? "generated-key",
      );
      let pendingDelivery: PendingMeteringDelivery | undefined;
      let claimCount = 0;
      vi.mocked(mockIdempotency.claimMeteringProcessingOrThrow).mockImplementation(async () => {
        claimCount += 1;
        return {
          operationId: "quota-operation",
          token: `claim-${claimCount}` as IdempotencyClaim,
          delivery: pendingDelivery,
        };
      });
      vi.mocked(mockIdempotency.markMeteringEventsPublishing).mockImplementation(
        async (_tenantId, _meterId, _idempotencyKey, _token, delivery) => {
          pendingDelivery = delivery;
        },
      );
      vi.mocked(mockIdempotency.completeMeteringProcessing).mockImplementation(async () => {
        pendingDelivery = undefined;
      });

      const publish = vi.mocked(mockEventBus.publish);
      publish.mockImplementation(async () => {
        if (publish.mock.calls.length === 1) {
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

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 999,
        idempotencyKey: "idem-publish-fail-quota",
      });

      expect(result).toBeDefined();
      expect(result.idempotencyKey).toBe("idem-publish-fail-quota");
      expect(result.value).toBe(5);
      expect(quotaCallCount).toBe(1);
      expect(recordedKeys).toEqual(new Set(["idem-publish-fail-quota"]));
      expect(mockRegistry.getOrThrow).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.abortMeteringProcessing).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringEvents).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.markMeteringEventsPublishing).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.completeMeteringProcessing).toHaveBeenCalledTimes(1);

      const firstQuotaEvent = publish.mock.calls[0]?.[0];
      const retriedQuotaEvent = publish.mock.calls[1]?.[0];
      expect(firstQuotaEvent).toBeInstanceOf(QuotaExceededEvent);
      expect(retriedQuotaEvent).toBeInstanceOf(QuotaExceededEvent);
      expect(retriedQuotaEvent?.eventId).toBe(firstQuotaEvent?.eventId);
      expect(publish.mock.calls[2]?.[0]).toBeInstanceOf(UsageRecordedEvent);
      expect(publish.mock.calls[2]?.[0]).toMatchObject({ value: 5 });
    });

    it("should recover usage event publication without duplicating non-quota usage", async () => {
      const meter = createMeter({ quota: undefined });
      vi.mocked(mockRegistry.getOrThrow).mockResolvedValue(meter);
      vi.mocked(mockIdempotency.ensureIdempotencyKey).mockImplementation(
        (key?: string) => key ?? "generated-key",
      );
      let pendingDelivery: PendingMeteringDelivery | undefined;
      let claimCount = 0;
      vi.mocked(mockIdempotency.claimMeteringProcessingOrThrow).mockImplementation(async () => {
        claimCount += 1;
        return {
          operationId: "usage-operation",
          token: `claim-${claimCount}` as IdempotencyClaim,
          delivery: pendingDelivery,
        };
      });
      vi.mocked(mockIdempotency.markMeteringEventsPublishing).mockImplementation(
        async (_tenantId, _meterId, _idempotencyKey, _token, delivery) => {
          pendingDelivery = delivery;
        },
      );
      vi.mocked(mockIdempotency.completeMeteringProcessing).mockImplementation(async () => {
        pendingDelivery = undefined;
      });
      const recordedKeys = new Set<string>();
      let persistedUsageCount = 0;
      vi.mocked(mockStorage.record).mockImplementation(async (usage) => {
        if (!recordedKeys.has(usage.idempotencyKey)) {
          recordedKeys.add(usage.idempotencyKey);
          persistedUsageCount += 1;
        }
      });

      const publish = vi.mocked(mockEventBus.publish);
      publish.mockImplementation(async () => {
        if (publish.mock.calls.length === 1) {
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

      const result = await service.record({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 999,
        idempotencyKey: "idem-publish-fail-non-quota",
      });

      expect(result).toBeDefined();
      expect(result.idempotencyKey).toBe("idem-publish-fail-non-quota");
      expect(result.value).toBe(1);
      expect(persistedUsageCount).toBe(1);
      expect(mockRegistry.getOrThrow).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.abortMeteringProcessing).not.toHaveBeenCalled();
      expect(mockIdempotency.releaseMeteringEvents).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.markMeteringEventsPublishing).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.completeMeteringProcessing).toHaveBeenCalledTimes(1);

      const firstUsageEvent = publish.mock.calls[0]?.[0];
      const retriedUsageEvent = publish.mock.calls[1]?.[0];
      expect(firstUsageEvent).toBeInstanceOf(UsageRecordedEvent);
      expect(retriedUsageEvent).toBeInstanceOf(UsageRecordedEvent);
      expect(retriedUsageEvent?.eventId).toBe(firstUsageEvent?.eventId);
      expect(retriedUsageEvent).toMatchObject({ value: 1 });
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
