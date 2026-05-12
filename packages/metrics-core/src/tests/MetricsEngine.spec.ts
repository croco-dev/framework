import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CarryingCapacityCalculator,
  SimulationConfig,
  UserCCConfig,
} from "../libs/CarryingCapacityCalculator";
import type { GrowthCalculator } from "../libs/GrowthCalculator";
import type { PlanProvider } from "../libs/interfaces/PlanProvider";
import type { LtvCalculator, LtvConfig } from "../libs/LtvCalculator";
import { MetricsEngine } from "../libs/MetricsEngine";
import type { MrrCalculator } from "../libs/MrrCalculator";
import type { RetentionCalculator } from "../libs/RetentionCalculator";
import type { SnapshotInput, SnapshotScheduler } from "../libs/SnapshotScheduler";
import type { Money, MRRMovement, SubscriptionSnapshot } from "../types";

describe("MetricsEngine", () => {
  let engine!: MetricsEngine;
  let mockMrrCalculator!: MrrCalculator;
  let mockRetentionCalculator!: RetentionCalculator;
  let mockGrowthCalculator!: GrowthCalculator;
  let mockCcCalculator!: CarryingCapacityCalculator;
  let mockLtvCalculator!: LtvCalculator;
  let mockSnapshotScheduler!: SnapshotScheduler;

  beforeEach(() => {
    mockMrrCalculator = {
      calculateMRR: vi.fn(),
      classifyMRRMovement: vi.fn(),
    } as unknown as MrrCalculator;

    mockRetentionCalculator = {
      calculateChurn: vi.fn(),
      calculateGRR: vi.fn(),
      calculateNRR: vi.fn(),
    } as unknown as RetentionCalculator;

    mockGrowthCalculator = {
      calculateQuickRatio: vi.fn(),
    } as unknown as GrowthCalculator;

    mockCcCalculator = {
      calculateUserCC: vi.fn(),
      simulate: vi.fn(),
    } as unknown as CarryingCapacityCalculator;

    mockLtvCalculator = {
      calculateLTV: vi.fn(),
      calculateARPA: vi.fn(),
    } as unknown as LtvCalculator;

    mockSnapshotScheduler = {
      captureSnapshot: vi.fn(),
    } as unknown as SnapshotScheduler;

    engine = new MetricsEngine(
      mockMrrCalculator,
      mockRetentionCalculator,
      mockGrowthCalculator,
      mockCcCalculator,
      mockLtvCalculator,
      mockSnapshotScheduler,
    );
  });

  describe("MRR Methods", () => {
    it("should delegate calculateMRR to MrrCalculator", async () => {
      const subscriptions: SubscriptionSnapshot[] = [
        {
          id: "sub_1",
          planId: "plan_monthly_10",
        },
      ];
      const planProvider = {} as PlanProvider;
      const expected: Money = { amount: 1000, currency: "USD" };
      vi.mocked(mockMrrCalculator.calculateMRR).mockResolvedValue(expected);

      const result = await engine.calculateMRR(subscriptions, planProvider);

      expect(result).toEqual(expected);
      expect(mockMrrCalculator.calculateMRR).toHaveBeenCalledWith(subscriptions, planProvider);
    });

    it("should delegate getMRRMovement to MrrCalculator", () => {
      const expected = "new" as const;
      vi.mocked(mockMrrCalculator.classifyMRRMovement).mockReturnValue(expected);

      const result = engine.getMRRMovement(false, false, null, 1000);

      expect(result).toBe(expected);
      expect(mockMrrCalculator.classifyMRRMovement).toHaveBeenCalledWith(false, false, null, 1000);
    });
  });

  describe("Retention Methods", () => {
    it("should delegate calculateChurn to RetentionCalculator", async () => {
      const expected = 5.5;
      vi.mocked(mockRetentionCalculator.calculateChurn).mockResolvedValue(expected);

      const result = await engine.calculateChurn(10000, {} as MRRMovement, "revenue");

      expect(result).toBe(expected);
      expect(mockRetentionCalculator.calculateChurn).toHaveBeenCalledWith(10000, {}, "revenue");
    });

    it("should delegate calculateGRR to RetentionCalculator", async () => {
      const expected = 95.0;
      vi.mocked(mockRetentionCalculator.calculateGRR).mockResolvedValue(expected);

      const result = await engine.calculateGRR(10000, {} as MRRMovement);

      expect(result).toBe(expected);
      expect(mockRetentionCalculator.calculateGRR).toHaveBeenCalledWith(10000, {});
    });

    it("should delegate calculateNRR to RetentionCalculator", async () => {
      const expected = 105.0;
      vi.mocked(mockRetentionCalculator.calculateNRR).mockResolvedValue(expected);

      const result = await engine.calculateNRR(10000, {} as MRRMovement);

      expect(result).toBe(expected);
      expect(mockRetentionCalculator.calculateNRR).toHaveBeenCalledWith(10000, {});
    });
  });

  describe("Growth Methods", () => {
    it("should delegate calculateQuickRatio to GrowthCalculator", async () => {
      const expected = 3.5;
      vi.mocked(mockGrowthCalculator.calculateQuickRatio).mockResolvedValue(expected);

      const result = await engine.calculateQuickRatio({} as MRRMovement);

      expect(result).toBe(expected);
      expect(mockGrowthCalculator.calculateQuickRatio).toHaveBeenCalledWith({});
    });
  });

  describe("Carrying Capacity Methods", () => {
    it("should delegate getCarryingCapacity to CarryingCapacityCalculator", async () => {
      const config: UserCCConfig = { lookbackDays: 30, tenantId: "tenant-123" };
      const expected = {
        capacity: 50000,
        current: 10000,
        headroom: 40000,
        headroomPercent: 80,
        dailyInflow: 100,
        dailyChurnRate: 0.02,
      };
      vi.mocked(mockCcCalculator.calculateUserCC).mockResolvedValue(expected);

      const result = await engine.getCarryingCapacity(config);

      expect(result).toEqual(expected);
      expect(mockCcCalculator.calculateUserCC).toHaveBeenCalledWith(config);
    });

    it("should delegate simulateCapacity to CarryingCapacityCalculator", async () => {
      const changes: SimulationConfig = { tenantId: "tenant-123", churnChange: -20 };
      const expected = {
        baseline: {
          capacity: 50000,
          current: 10000,
          headroom: 40000,
          headroomPercent: 80,
          dailyInflow: 100,
          dailyChurnRate: 0.02,
        },
        simulated: {
          capacity: 62500,
          current: 10000,
          headroom: 52500,
          headroomPercent: 84,
          dailyInflow: 100,
          dailyChurnRate: 0.016,
        },
        capacityDelta: 12500,
        headroomDelta: 12500,
        headroomPercentDelta: 4,
      };
      vi.mocked(mockCcCalculator.simulate).mockResolvedValue(expected);

      const result = await engine.simulateCapacity(changes);

      expect(result).toEqual(expected);
      expect(mockCcCalculator.simulate).toHaveBeenCalledWith(changes);
    });
  });

  describe("Customer Value Methods", () => {
    it("should delegate calculateLTV to LtvCalculator", async () => {
      const config: LtvConfig = { arpa: { amount: 1000, currency: "USD" }, monthlyChurnRate: 5 };
      const expected: Money = { amount: 20000, currency: "USD" };
      vi.mocked(mockLtvCalculator.calculateLTV).mockResolvedValue(expected);

      const result = await engine.calculateLTV(config);

      expect(result).toEqual(expected);
      expect(mockLtvCalculator.calculateLTV).toHaveBeenCalledWith(config);
    });

    it("should delegate calculateARPA to LtvCalculator", async () => {
      const period = { from: new Date(), to: new Date(), granularity: "month" as const };
      const mrr: Money = { amount: 10000, currency: "USD" };
      const activeCustomers = 100;
      const expected: Money = { amount: 100, currency: "USD" };
      vi.mocked(mockLtvCalculator.calculateARPA).mockResolvedValue(expected);

      const result = await engine.calculateARPA(period, mrr, activeCustomers);

      expect(result).toEqual(expected);
      expect(mockLtvCalculator.calculateARPA).toHaveBeenCalledWith(period, mrr, activeCustomers);
    });
  });

  describe("Snapshot Methods", () => {
    it("should delegate captureSnapshot to SnapshotScheduler without tenantId", async () => {
      const input: SnapshotInput = {
        subscriptions: [],
        planProvider: {} as PlanProvider,
        activeCustomers: 100,
      };
      const date = new Date("2026-02-01");
      vi.mocked(mockSnapshotScheduler.captureSnapshot).mockResolvedValue(undefined);

      await engine.captureSnapshot(input, date);

      expect(mockSnapshotScheduler.captureSnapshot).toHaveBeenCalledWith(input, date, undefined);
    });

    it("should delegate captureSnapshot to SnapshotScheduler with tenantId", async () => {
      const input: SnapshotInput = {
        subscriptions: [],
        planProvider: {} as PlanProvider,
        activeCustomers: 100,
      };
      const date = new Date("2026-02-01");
      const tenantId = "tenant-123";
      vi.mocked(mockSnapshotScheduler.captureSnapshot).mockResolvedValue(undefined);

      await engine.captureSnapshot(input, date, tenantId);

      expect(mockSnapshotScheduler.captureSnapshot).toHaveBeenCalledWith(input, date, { tenantId });
    });

    it("should delegate captureSnapshot to SnapshotScheduler with default date", async () => {
      const input: SnapshotInput = {
        subscriptions: [],
        planProvider: {} as PlanProvider,
        activeCustomers: 100,
      };
      vi.mocked(mockSnapshotScheduler.captureSnapshot).mockResolvedValue(undefined);

      await engine.captureSnapshot(input);

      expect(mockSnapshotScheduler.captureSnapshot).toHaveBeenCalledWith(
        input,
        undefined,
        undefined,
      );
    });
  });
});
