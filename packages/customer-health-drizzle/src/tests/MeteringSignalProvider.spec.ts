import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@croco/customer-health-core", () => ({
  SignalProvider: class {},
}));

import type { UsageStorage } from "../libs/MeteringSignalProvider";
import { MeteringSignalProvider } from "../libs/MeteringSignalProvider";
import { InvalidMeteringInputProblem } from "../libs/problems/DrizzleHealthProblems";

describe("MeteringSignalProvider", () => {
  let provider!: MeteringSignalProvider;
  let mockUsageStorage!: UsageStorage;

  beforeEach(() => {
    mockUsageStorage = {
      getUsage: vi.fn(),
    };
    provider = new MeteringSignalProvider(mockUsageStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should have category as usage", () => {
    expect(provider.category).toBe("usage");
  });

  it("should collect usage signals", async () => {
    const mockUsageData = {
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 5,
      limit: 10,
      features: [
        { key: "projects", usage: 3, limit: 5 },
        { key: "teams", usage: 2, limit: 10 },
      ],
    };

    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue(mockUsageData);

    const signals = await provider.collect("tenant-1");

    expect(signals).toHaveLength(3);
    expect(signals[0].category).toBe("usage");
    expect(signals[0].name).toBe("overall_usage");
    expect(signals[0].value).toBeGreaterThan(0);
    expect(signals[0].weight).toBe(0.5);
  });

  it("should normalize score to 100 when usage is below 50%", async () => {
    const mockUsageData = {
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 4,
      limit: 10,
      features: [],
    };

    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue(mockUsageData);

    const signals = await provider.collect("tenant-1");

    expect(signals[0].value).toBe(100);
  });

  it("should normalize score to 0 when usage exceeds limit", async () => {
    const mockUsageData = {
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 12,
      limit: 10,
      features: [],
    };

    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue(mockUsageData);

    const signals = await provider.collect("tenant-1");

    expect(signals[0].value).toBeLessThanOrEqual(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects an invalid overall limit of %s",
    async (limit) => {
      vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue({
        tenantId: "tenant-1",
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        usage: 5,
        limit,
        features: [],
      });

      await expect(provider.collect("tenant-1")).rejects.toThrow(InvalidMeteringInputProblem);
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects an invalid overall usage of %s",
    async (usage) => {
      vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue({
        tenantId: "tenant-1",
        periodStart: new Date("2026-03-01"),
        periodEnd: new Date("2026-03-31"),
        usage,
        limit: 10,
        features: [],
      });

      await expect(provider.collect("tenant-1")).rejects.toThrow(InvalidMeteringInputProblem);
    },
  );

  it("rejects invalid feature usage before returning signals", async () => {
    const mockUsageData = {
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 5,
      limit: 10,
      features: [{ key: "projects", usage: 1, limit: 0 }],
    };

    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue(mockUsageData);

    await expect(provider.collect("tenant-1")).rejects.toThrow(InvalidMeteringInputProblem);
  });

  it("reports the invalid metering field with a stable Problem", async () => {
    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue({
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 5,
      limit: 10,
      features: [{ key: "projects", usage: -1, limit: 5 }],
    });

    await expect(provider.collect("tenant-1")).rejects.toMatchObject({
      code: "customer-health-drizzle/invalid-metering-input",
      input: "features[0].usage",
      receivedValue: "-1",
    });
  });

  it("preserves valid usage boundaries", async () => {
    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue({
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 0,
      limit: Number.MIN_VALUE,
      features: [],
    });

    const signals = await provider.collect("tenant-1");

    expect(signals[0].value).toBe(100);
  });

  it("should collect feature usage signals", async () => {
    const mockUsageData = {
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      usage: 5,
      limit: 10,
      features: [
        { key: "projects", usage: 4, limit: 5 },
        { key: "teams", usage: 8, limit: 10 },
      ],
    };

    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue(mockUsageData);

    const signals = await provider.collect("tenant-1");

    expect(signals).toHaveLength(3);
    expect(signals[1].name).toBe("feature_projects");
    expect(signals[2].name).toBe("feature_teams");
  });

  it("should query the complete current UTC month as a half-open interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T23:59:59.999Z"));
    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue({
      tenantId: "tenant-1",
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-01T00:00:00.000Z"),
      usage: 0,
      limit: 10,
      features: [],
    });

    await provider.collect("tenant-1");

    expect(mockUsageStorage.getUsage).toHaveBeenCalledWith(
      "tenant-1",
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-04-01T00:00:00.000Z"),
    );
  });

  it("should roll the UTC monthly interval into the next year", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-15T12:00:00.000Z"));
    vi.spyOn(mockUsageStorage, "getUsage").mockResolvedValue({
      tenantId: "tenant-1",
      periodStart: new Date("2026-12-01T00:00:00.000Z"),
      periodEnd: new Date("2027-01-01T00:00:00.000Z"),
      usage: 0,
      limit: 10,
      features: [],
    });

    await provider.collect("tenant-1");

    expect(mockUsageStorage.getUsage).toHaveBeenCalledWith(
      "tenant-1",
      new Date("2026-12-01T00:00:00.000Z"),
      new Date("2027-01-01T00:00:00.000Z"),
    );
  });
});
