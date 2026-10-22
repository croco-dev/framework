import { InMemoryPlanRegistry, planVersionRef } from "@croco/billing-core";
import type { BillingStore, PlanVersionDefinition } from "@croco/billing-core";
import type { MetricsRepository } from "@croco/metrics-core";
import { MrrCalculator, SnapshotScheduler } from "@croco/metrics-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingEventHandler } from "../libs/BillingEventHandler";

const version = (
  versionId: string,
  amount: number,
  effectiveAt: string,
): PlanVersionDefinition => ({
  ref: planVersionRef(`pro@${versionId}`),
  planId: "pro",
  versionId,
  effectiveAt,
  name: "Pro",
  amount,
  currency: "USD",
  interval: "month",
  intervalCount: 1,
  rating: { mode: "provider", provider: "test" },
  quantityPolicy: {
    minimumQuantity: 1,
    includedSeats: 0,
    seatQuota: 10,
    billableMembershipRoles: ["owner"],
  },
  providerBindings: [{ provider: "test", productId: `pro-${versionId}`, priceIds: [] }],
});

const historicalInput = [{ id: "sub-old", planId: "pro", pricingRef: "pro@v1" }];

function setup() {
  const registry = new InMemoryPlanRegistry();
  const repository = {
    mrrMovementIdentityVersion: 2,
    getMRRHistory: vi.fn().mockResolvedValue([]),
    recordSnapshot: vi.fn(),
  } as unknown as MetricsRepository;
  const handler = new BillingEventHandler(registry, {} as BillingStore, repository);
  return { registry, repository, handler, calculator: new MrrCalculator() };
}

describe("Pinned MRR", () => {
  afterEach(() => vi.useRealTimers());

  it("preserves historical snapshots across a future-effective price release and activation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const { registry, repository, handler } = setup();
    await registry.publishPlanVersion(version("v1", 1100, "2026-01-01T00:00:00.000Z"));
    const scheduler = new SnapshotScheduler(repository);
    const input = { subscriptions: historicalInput, planProvider: handler, activeCustomers: 1 };
    const date = new Date("2026-02-01T00:00:00Z");
    await scheduler.captureSnapshot(input, date, { tenantId: "tenant" });
    await registry.publishPlanVersion(version("v2", 2700, "2026-04-01T00:00:00.000Z"));
    await scheduler.captureSnapshot(input, date, { tenantId: "tenant" });
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    await scheduler.captureSnapshot(input, date, { tenantId: "tenant" });
    expect(repository.recordSnapshot).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(repository.recordSnapshot).mock.calls) {
      expect(call[1].totalMRR).toEqual({ amount: 1100, currency: "USD" });
    }
  });

  it("sums different pinned versions of the same plan family", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    const { registry, handler, calculator } = setup();
    await registry.publishPlanVersion(version("v1", 1100, "2026-01-01T00:00:00.000Z"));
    await registry.publishPlanVersion(version("v2", 2700, "2026-04-01T00:00:00.000Z"));
    await expect(
      calculator.calculateMRR(
        [...historicalInput, { id: "sub-new", planId: "pro", pricingRef: "pro@v2" }],
        handler,
      ),
    ).resolves.toEqual({ amount: 3800, currency: "USD" });
  });

  it("rejects missing pinned prices instead of using an available current price or writing a partial snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    const { registry, repository, handler } = setup();
    await registry.publishPlanVersion(version("v2", 2700, "2026-04-01T00:00:00.000Z"));
    await expect(
      new SnapshotScheduler(repository).captureSnapshot(
        {
          subscriptions: [
            { id: "sub-new", planId: "pro", pricingRef: "pro@v2" },
            ...historicalInput,
          ],
          planProvider: handler,
          activeCustomers: 2,
        },
        new Date("2026-02-01T00:00:00Z"),
        { tenantId: "tenant" },
      ),
    ).rejects.toMatchObject({
      code: "metrics-core/subscription-pricing-unavailable",
    });
    expect(repository.recordSnapshot).not.toHaveBeenCalled();
  });
});
