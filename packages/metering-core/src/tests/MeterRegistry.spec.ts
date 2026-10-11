import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeterRegistry } from "../libs/MeterRegistry";
import type { MeterRepository } from "../libs/MeterRepository";
import { InvalidMeterProblem } from "../libs/problems/InvalidMeterProblem";
import type { BillableUsageJournal } from "../libs/BillableUsageJournal";
import type { MeterDefinition, MeterRegistrationOptions } from "../libs/types";

describe("MeterRegistry", () => {
  let registry!: MeterRegistry;
  let mockRepository!: MeterRepository;

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
    mockRepository = {
      replayContract: "idempotent",
      findByMeterIdAndTenant: vi.fn(),
      save: vi.fn(),
      findAll: vi.fn(),
      findByTenant: vi.fn(),
      saveUsageRecords: vi.fn(),
    };
    registry = new MeterRegistry(mockRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("loadAll", () => {
    it("should reject a required billing meter without a persistent journal", async () => {
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter({ billing: "required" })]);

      await expect(registry.loadAll()).rejects.toMatchObject({
        code: "metering/billable-usage-journal-required",
      });
    });

    it("should load a required billing meter with a persistent journal", async () => {
      const journal = { durability: "persistent" } as BillableUsageJournal;
      registry = new MeterRegistry(mockRepository, 60_000, journal);
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter({ billing: "required" })]);

      await expect(registry.loadAll()).resolves.toBeUndefined();
    });

    it("should reject a required billing meter with a volatile journal", async () => {
      const journal = { durability: "volatile" } as BillableUsageJournal;
      registry = new MeterRegistry(mockRepository, 60_000, journal);
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter({ billing: "required" })]);

      await expect(registry.loadAll()).rejects.toMatchObject({
        code: "metering/billable-usage-journal-required",
      });
    });

    it("should load all meters from repository", async () => {
      const meters = [
        createMeter({ tenantId: "tenant-1", meterId: "api_calls" }),
        createMeter({ tenantId: "tenant-2", meterId: "storage" }),
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue(meters);

      await registry.loadAll();

      expect(mockRepository.findAll).toHaveBeenCalled();

      // 캐시에서 직접 조회 가능해야 함
      const result1 = await registry.get("tenant-1", "api_calls");
      const result2 = await registry.get("tenant-2", "storage");

      expect(result1?.meterId).toBe("api_calls");
      expect(result2?.meterId).toBe("storage");

      // DB 추가 조회 없어야 함
      expect(mockRepository.findByMeterIdAndTenant).not.toHaveBeenCalled();
    });

    it("should clear cache before loading", async () => {
      const meter1 = createMeter({ meterId: "old_meter" });
      vi.mocked(mockRepository.findAll).mockResolvedValue([meter1]);
      await registry.loadAll();

      const meter2 = createMeter({ meterId: "new_meter" });
      vi.mocked(mockRepository.findAll).mockResolvedValue([meter2]);
      await registry.loadAll();

      // old_meter는 없어야 함
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(null);
      const oldResult = await registry.get("tenant-1", "old_meter");
      expect(oldResult).toBeNull();
    });
  });

  describe("get", () => {
    it("should return meter from cache if available", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findAll).mockResolvedValue([meter]);
      await registry.loadAll();

      const result = await registry.get("tenant-1", "api_calls");

      expect(result).toEqual(meter);
      expect(mockRepository.findByMeterIdAndTenant).not.toHaveBeenCalled();
    });

    it("should fetch from repository if not in cache", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(meter);

      const result = await registry.get("tenant-1", "api_calls");

      expect(result).toEqual(meter);
      expect(mockRepository.findByMeterIdAndTenant).toHaveBeenCalledWith("api_calls", "tenant-1");
    });

    it("should reject a lazily fetched required meter without a persistent journal", async () => {
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(
        createMeter({ billing: "required" }),
      );

      await expect(registry.get("tenant-1", "api_calls")).rejects.toMatchObject({
        code: "metering/billable-usage-journal-required",
      });
    });

    it("should cache meter after fetching from repository", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(meter);

      await registry.get("tenant-1", "api_calls");
      await registry.get("tenant-1", "api_calls");

      // 한 번만 호출되어야 함
      expect(mockRepository.findByMeterIdAndTenant).toHaveBeenCalledTimes(1);
    });

    it("should return null for non-existent meter", async () => {
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(null);

      const result = await registry.get("tenant-1", "unknown");

      expect(result).toBeNull();
    });

    it("should isolate meters by tenant", async () => {
      const tenant1Meter = createMeter({ tenantId: "tenant-1", meterId: "api_calls" });
      const tenant2Meter = createMeter({ tenantId: "tenant-2", meterId: "api_calls", quota: 2000 });

      vi.mocked(mockRepository.findAll).mockResolvedValue([tenant1Meter, tenant2Meter]);
      await registry.loadAll();

      const result1 = await registry.get("tenant-1", "api_calls");
      const result2 = await registry.get("tenant-2", "api_calls");

      expect(result1?.quota).toBe(1000);
      expect(result2?.quota).toBe(2000);
    });

    it("should refresh stale tenant cache before returning cached meter", async () => {
      vi.useFakeTimers();
      const initialMeter = createMeter({ quota: 1000 });
      vi.mocked(mockRepository.findAll).mockResolvedValue([initialMeter]);
      await registry.loadAll();

      vi.setSystemTime(Date.now() + 61_000);
      const refreshedMeter = createMeter({ quota: 2000 });
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([refreshedMeter]);

      const result = await registry.get("tenant-1", "api_calls");

      expect(mockRepository.findByTenant).toHaveBeenCalledWith("tenant-1");
      expect(result?.quota).toBe(2000);
      expect(mockRepository.findByMeterIdAndTenant).not.toHaveBeenCalled();
    });
  });

  describe("getOrThrow", () => {
    it("should return meter if found", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(meter);

      const result = await registry.getOrThrow("tenant-1", "api_calls");

      expect(result).toEqual(meter);
    });

    it("should throw InvalidMeterProblem if not found", async () => {
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(null);

      await expect(registry.getOrThrow("tenant-1", "unknown")).rejects.toThrow(InvalidMeterProblem);
    });

    it("should include meter and tenant in error", async () => {
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(null);

      try {
        await registry.getOrThrow("my-tenant", "my-meter");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidMeterProblem);
        const problem = error as InvalidMeterProblem;
        expect(problem.message).toContain("my-meter");
        expect(problem.message).toContain("my-tenant");
      }
    });
  });

  describe("register", () => {
    it("should save meter and add to cache", async () => {
      const options: MeterRegistrationOptions = {
        tenantId: "tenant-1",
        meterId: "new_meter",
        type: "COUNT",
      };
      const savedMeter = createMeter({ meterId: "new_meter" });
      vi.mocked(mockRepository.save).mockResolvedValue(savedMeter);

      const result = await registry.register(options);

      expect(result).toEqual(savedMeter);
      expect(mockRepository.save).toHaveBeenCalledWith(options);

      // 캐시에서 조회 가능해야 함
      const cached = await registry.get("tenant-1", "new_meter");
      expect(cached).toEqual(savedMeter);
      expect(mockRepository.findByMeterIdAndTenant).not.toHaveBeenCalled();
    });

    it("should validate the billing contract returned by the repository before caching", async () => {
      const options: MeterRegistrationOptions = {
        tenantId: "tenant-1",
        meterId: "new_meter",
        type: "COUNT",
      };
      vi.mocked(mockRepository.save).mockResolvedValue(
        createMeter({ meterId: "new_meter", billing: "required" }),
      );

      await expect(registry.register(options)).rejects.toMatchObject({
        code: "metering/billable-usage-journal-required",
      });
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(null);
      await expect(registry.get("tenant-1", "new_meter")).resolves.toBeNull();
    });
  });

  describe("getByTenant", () => {
    it("should load the complete tenant snapshot after a lazy single-meter lookup", async () => {
      const apiMeter = createMeter();
      const meters = [apiMeter, createMeter({ meterId: "storage" })];
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(apiMeter);
      vi.mocked(mockRepository.findByTenant).mockResolvedValue(meters);

      await registry.get("tenant-1", "api_calls");

      await expect(registry.getByTenant("tenant-1")).resolves.toEqual(meters);
      await expect(registry.getByTenant("tenant-1")).resolves.toEqual(meters);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(1);
    });

    it("should include existing meters after registering into a cold cache", async () => {
      const existingMeter = createMeter();
      const savedMeter = createMeter({ meterId: "storage" });
      const meters = [existingMeter, savedMeter];
      vi.mocked(mockRepository.save).mockResolvedValue(savedMeter);
      vi.mocked(mockRepository.findByTenant).mockResolvedValue(meters);

      await registry.register({ tenantId: "tenant-1", meterId: "storage", type: "COUNT" });

      await expect(registry.getByTenant("tenant-1")).resolves.toEqual(meters);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(1);
    });

    it("should reuse an empty snapshot until its TTL boundary", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([]);

      await expect(registry.getByTenant("tenant-1")).resolves.toEqual([]);
      vi.advanceTimersByTime(59_999);
      await expect(registry.getByTenant("tenant-1")).resolves.toEqual([]);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await expect(registry.getByTenant("tenant-1")).resolves.toEqual([]);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);
    });

    it.each(["get", "register"] as const)(
      "should not extend the complete snapshot TTL after a single-meter %s",
      async (operation) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
        const initialMeter = createMeter();
        const addedMeter = createMeter({ meterId: "storage" });
        const externalMeter = createMeter({ meterId: "external" });
        vi.mocked(mockRepository.findByTenant)
          .mockResolvedValueOnce([initialMeter])
          .mockResolvedValueOnce([initialMeter, addedMeter, externalMeter]);
        await registry.getByTenant("tenant-1");

        vi.advanceTimersByTime(30_000);
        if (operation === "get") {
          vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(addedMeter);
          await registry.get("tenant-1", "storage");
        } else {
          vi.mocked(mockRepository.save).mockResolvedValue(addedMeter);
          await registry.register({ tenantId: "tenant-1", meterId: "storage", type: "COUNT" });
        }
        await expect(registry.getByTenant("tenant-1")).resolves.toEqual([initialMeter, addedMeter]);
        expect(mockRepository.findByTenant).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(30_000);
        await expect(registry.getByTenant("tenant-1")).resolves.toEqual([
          initialMeter,
          addedMeter,
          externalMeter,
        ]);
        expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);
      },
    );

    it("should discard snapshot completeness when clearing or reloading the cache", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([meter]);
      await registry.getByTenant("tenant-1");
      registry.clearCache();
      await registry.getByTenant("tenant-1");
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);

      vi.mocked(mockRepository.findAll).mockResolvedValue([]);
      await registry.loadAll();
      await expect(registry.getByTenant("tenant-1")).resolves.toEqual([meter]);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(3);
    });

    it("should keep completeness isolated by tenant", async () => {
      const apiMeter = createMeter();
      const storageMeter = createMeter({ meterId: "storage" });
      const otherTenantMeter = createMeter({ tenantId: "tenant-2" });
      vi.mocked(mockRepository.findAll).mockResolvedValue([otherTenantMeter]);
      await registry.loadAll();
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(apiMeter);
      await registry.get("tenant-1", "api_calls");
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([apiMeter, storageMeter]);

      await expect(registry.getByTenant("tenant-2")).resolves.toEqual([otherTenantMeter]);
      await expect(registry.getByTenant("tenant-1")).resolves.toEqual([apiMeter, storageMeter]);
      expect(mockRepository.findByTenant).toHaveBeenCalledExactlyOnceWith("tenant-1");
    });

    it("should not mark a rejected tenant refresh as complete", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(meter);
      await registry.get("tenant-1", "api_calls");
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([
        meter,
        createMeter({ meterId: "storage", billing: "required" }),
      ]);

      await expect(registry.getByTenant("tenant-1")).rejects.toMatchObject({
        code: "metering/billable-usage-journal-required",
      });
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([meter]);
      await expect(registry.getByTenant("tenant-1")).resolves.toEqual([meter]);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);
    });

    it("should return all meters for tenant from cache", async () => {
      const meters = [createMeter({ meterId: "meter1" }), createMeter({ meterId: "meter2" })];
      vi.mocked(mockRepository.findAll).mockResolvedValue(meters);
      await registry.loadAll();

      const result = await registry.getByTenant("tenant-1");

      expect(result).toHaveLength(2);
      expect(mockRepository.findByTenant).not.toHaveBeenCalled();
    });

    it("should fetch from repository if cache is empty", async () => {
      const meters = [createMeter({ meterId: "meter1" })];
      vi.mocked(mockRepository.findByTenant).mockResolvedValue(meters);

      const result = await registry.getByTenant("tenant-1");

      expect(result).toEqual(meters);
      expect(mockRepository.findByTenant).toHaveBeenCalledWith("tenant-1");
    });

    it("should reject a required meter discovered during tenant refresh", async () => {
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([
        createMeter({ billing: "required" }),
      ]);

      await expect(registry.getByTenant("tenant-1")).rejects.toMatchObject({
        code: "metering/billable-usage-journal-required",
      });
    });

    it("should refetch tenant meters when cached data becomes stale", async () => {
      vi.useFakeTimers();
      const initialMeters = [createMeter({ meterId: "meter1" })];
      vi.mocked(mockRepository.findAll).mockResolvedValue(initialMeters);
      await registry.loadAll();

      vi.setSystemTime(Date.now() + 61_000);
      const refreshedMeters = [createMeter({ meterId: "meter1", quota: 2000 })];
      vi.mocked(mockRepository.findByTenant).mockResolvedValue(refreshedMeters);

      const result = await registry.getByTenant("tenant-1");

      expect(mockRepository.findByTenant).toHaveBeenCalledWith("tenant-1");
      expect(result[0]?.quota).toBe(2000);
    });
  });

  describe("in-flight tenant refresh", () => {
    const deferred = <T>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((complete) => {
        resolve = complete;
      });
      return { promise, resolve };
    };

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter({ quota: 10 })]);
      await registry.loadAll();
      vi.advanceTimersByTime(61_000);
    });

    it.each(["api_calls", "new_meter"])(
      "should preserve a successful registration of %s",
      async (meterId) => {
        const pending = deferred<MeterDefinition[]>();
        vi.mocked(mockRepository.findByTenant).mockReturnValueOnce(pending.promise);
        const refreshing = registry.getByTenant("tenant-1");
        expect(mockRepository.findByTenant).toHaveBeenCalledTimes(1);
        const registered = createMeter({ meterId, quota: 20 });
        vi.mocked(mockRepository.save).mockResolvedValue(registered);
        await registry.register({ tenantId: "tenant-1", meterId, type: "COUNT", quota: 20 });
        pending.resolve([createMeter({ quota: 10 })]);

        expect(await refreshing).toContainEqual(registered);
        expect(await registry.get("tenant-1", meterId)).toEqual(registered);
        const external = createMeter({ meterId: "external" });
        const currentSnapshot =
          meterId === "api_calls"
            ? [registered, external]
            : [createMeter({ quota: 10 }), registered, external];
        vi.mocked(mockRepository.findByTenant).mockResolvedValue(currentSnapshot);
        expect(await registry.getByTenant("tenant-1")).toEqual(currentSnapshot);
        expect(await registry.getByTenant("tenant-1")).toEqual(currentSnapshot);
        expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);
      },
    );

    it("should keep cache cleared when an earlier refresh completes", async () => {
      const pending = deferred<MeterDefinition[]>();
      vi.mocked(mockRepository.findByTenant).mockReturnValueOnce(pending.promise);
      const refreshing = registry.getByTenant("tenant-1");
      registry.clearCache();
      pending.resolve([createMeter({ quota: 10 })]);

      expect(await refreshing).toEqual([]);
      expect(registry.getCachedBillingRequirement("tenant-1", "api_calls")).toBe("unknown");
      const current = createMeter({ quota: 30 });
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([current]);
      expect(await registry.getByTenant("tenant-1")).toEqual([current]);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);
    });

    it("should fence a cold refresh across clearCache and a new registration", async () => {
      registry.clearCache();
      const pending = deferred<MeterDefinition[]>();
      vi.mocked(mockRepository.findByTenant).mockReturnValueOnce(pending.promise);
      const refreshing = registry.getByTenant("tenant-1");
      registry.clearCache();
      const current = createMeter({ quota: 40 });
      vi.mocked(mockRepository.save).mockResolvedValue(current);
      await registry.register({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
        quota: 40,
      });
      pending.resolve([createMeter({ quota: 10 })]);

      expect(await refreshing).toEqual([current]);
      expect(await registry.get("tenant-1", "api_calls")).toEqual(current);
    });

    it("should install a refresh despite another tenant registration", async () => {
      const pending = deferred<MeterDefinition[]>();
      vi.mocked(mockRepository.findByTenant).mockReturnValueOnce(pending.promise);
      const refreshing = registry.getByTenant("tenant-1");
      const other = createMeter({ tenantId: "tenant-2", quota: 40 });
      vi.mocked(mockRepository.save).mockResolvedValue(other);
      await registry.register({
        tenantId: "tenant-2",
        meterId: "api_calls",
        type: "COUNT",
        quota: 40,
      });
      const current = createMeter({ quota: 30 });
      pending.resolve([current]);

      expect(await refreshing).toEqual([current]);
      expect(await registry.get("tenant-1", "api_calls")).toEqual(current);
      expect(await registry.get("tenant-2", "api_calls")).toEqual(other);
    });

    it("should refresh again after the preserved registration TTL expires", async () => {
      const pending = deferred<MeterDefinition[]>();
      vi.mocked(mockRepository.findByTenant).mockReturnValueOnce(pending.promise);
      const refreshing = registry.get("tenant-1", "api_calls");
      const registered = createMeter({ quota: 20 });
      vi.mocked(mockRepository.save).mockResolvedValue(registered);
      await registry.register({
        tenantId: "tenant-1",
        meterId: "api_calls",
        type: "COUNT",
        quota: 20,
      });
      vi.advanceTimersByTime(30_000);
      pending.resolve([createMeter({ quota: 10 })]);
      expect(await refreshing).toEqual(registered);
      expect(await registry.get("tenant-1", "api_calls")).toEqual(registered);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(30_000);
      const current = createMeter({ quota: 30 });
      vi.mocked(mockRepository.findByTenant).mockResolvedValue([current]);
      expect(await registry.get("tenant-1", "api_calls")).toEqual(current);
      expect(mockRepository.findByTenant).toHaveBeenCalledTimes(2);
    });

    it("should preserve loadAll replacement when an earlier refresh completes", async () => {
      const pending = deferred<MeterDefinition[]>();
      vi.mocked(mockRepository.findByTenant).mockReturnValueOnce(pending.promise);
      const refreshing = registry.getByTenant("tenant-1");
      const current = createMeter({ meterId: "replacement", quota: 30 });
      vi.mocked(mockRepository.findAll).mockResolvedValue([current]);
      await registry.loadAll();
      pending.resolve([createMeter({ quota: 10 })]);

      expect(await refreshing).toEqual([current]);
      expect(await registry.getByTenant("tenant-1")).toEqual([current]);
    });

    it("should preserve the first installed snapshot when refreshes finish out of order", async () => {
      const older = deferred<MeterDefinition[]>();
      const newer = deferred<MeterDefinition[]>();
      vi.mocked(mockRepository.findByTenant)
        .mockReturnValueOnce(older.promise)
        .mockReturnValueOnce(newer.promise);
      const first = registry.getByTenant("tenant-1");
      const second = registry.getByTenant("tenant-1");
      const current = createMeter({ quota: 30 });
      newer.resolve([current]);
      expect(await second).toEqual([current]);
      older.resolve([createMeter({ quota: 10 })]);
      expect(await first).toEqual([current]);
      expect(await registry.get("tenant-1", "api_calls")).toEqual(current);
    });
  });

  describe("clearCache", () => {
    it("should clear all cached meters", async () => {
      const meter = createMeter();
      vi.mocked(mockRepository.findAll).mockResolvedValue([meter]);
      await registry.loadAll();

      registry.clearCache();

      vi.mocked(mockRepository.findByMeterIdAndTenant).mockResolvedValue(null);
      const result = await registry.get("tenant-1", "api_calls");

      expect(result).toBeNull();
      expect(mockRepository.findByMeterIdAndTenant).toHaveBeenCalled();
    });
  });

  describe("cached billing intent", () => {
    it("should resolve billing intent without repository I/O on the request path", async () => {
      const journal = { durability: "persistent" } as BillableUsageJournal;
      registry = new MeterRegistry(mockRepository, 60_000, journal);
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter({ billing: "required" })]);
      await registry.loadAll();
      vi.clearAllMocks();

      expect(registry.getCachedBillingRequirement("tenant-1", "api_calls")).toBe("required");
      expect(mockRepository.findByMeterIdAndTenant).not.toHaveBeenCalled();
      expect(mockRepository.findByTenant).not.toHaveBeenCalled();
    });

    it("should distinguish an unknown cold-cache contract from a known local meter", async () => {
      expect(registry.getCachedBillingRequirement("tenant-1", "api_calls")).toBe("unknown");
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter()]);
      await registry.loadAll();

      expect(registry.getCachedBillingRequirement("tenant-1", "api_calls")).toBe("local");
    });

    it("should treat an expired cached local contract as unknown before refresh", async () => {
      vi.useFakeTimers();
      vi.mocked(mockRepository.findAll).mockResolvedValue([createMeter()]);
      await registry.loadAll();
      vi.setSystemTime(Date.now() + 61_000);

      expect(registry.getCachedBillingRequirement("tenant-1", "api_calls")).toBe("unknown");
      expect(mockRepository.findByTenant).not.toHaveBeenCalled();
    });
  });
});
