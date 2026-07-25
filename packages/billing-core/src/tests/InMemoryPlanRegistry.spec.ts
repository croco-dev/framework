import { describe, expect, it } from "vitest";
import { InMemoryPlanRegistry, planVersionRef } from "../libs/InMemoryPlanRegistry";
import {
  InvalidPlanVersionDefinitionProblem,
  PlanVersionAlreadyPublishedProblem,
  UnknownPlanVersionMappingProblem,
} from "../libs/problems/BillingProblems";
import type { PlanVersionDefinition } from "../types";

function version(
  versionId: string,
  effectiveAt: string,
  productId: string,
  priceId: string,
  amount: number,
): PlanVersionDefinition {
  return {
    ref: planVersionRef(`pro@${versionId}`),
    planId: "pro",
    version: versionId,
    effectiveAt,
    publishedAt: "2025-12-01T00:00:00.000Z",
    plan: {
      id: "pro",
      name: "Pro",
      amount,
      currency: "USD",
      interval: "month",
      intervalCount: 1,
    },
    rating: { mode: "provider-rated" },
    providerBindings: [{ provider: "polar", productId, priceId }],
  };
}

describe("InMemoryPlanRegistry", () => {
  const grandfathered = version(
    "2026-01",
    "2026-01-01T00:00:00.000Z",
    "polar-pro",
    "price-pro-v1",
    2_900,
  );
  const current = version(
    "2026-06",
    "2026-06-01T00:00:00.000Z",
    "polar-pro",
    "price-pro-v2",
    3_900,
  );
  const future = version(
    "2099-01",
    "2099-01-01T00:00:00.000Z",
    "polar-pro-future",
    "price-pro-future",
    4_900,
  );

  it("returns an identified historical version without selecting a future version", async () => {
    const registry = new InMemoryPlanRegistry([grandfathered, current, future]);

    await expect(
      registry.getPlanAtDate("pro", new Date("2026-03-01T00:00:00.000Z")),
    ).resolves.toMatchObject({
      ref: grandfathered.ref,
      version: grandfathered.version,
      plan: { amount: 2_900 },
    });
    await expect(registry.getPlan("pro")).resolves.toMatchObject({
      ref: current.ref,
      plan: { amount: 3_900 },
    });
    await expect(registry.getAllPlans()).resolves.toEqual([
      expect.objectContaining({ ref: current.ref }),
    ]);
  });

  it("keeps published snapshots immutable and rejects overwrites", async () => {
    const sourcePlan = { ...grandfathered.plan };
    const source: PlanVersionDefinition = {
      ...grandfathered,
      plan: sourcePlan,
    };
    const registry = new InMemoryPlanRegistry([source]);
    sourcePlan.amount = 99_999;

    await expect(registry.getPlanVersion(grandfathered.ref)).resolves.toMatchObject({
      plan: { amount: 2_900 },
    });
    await expect(registry.publishPlanVersion(grandfathered)).rejects.toBeInstanceOf(
      PlanVersionAlreadyPublishedProblem,
    );
    await expect(
      registry.publishPlanVersion({
        ...grandfathered,
        ref: planVersionRef("pro@duplicate-version"),
        effectiveAt: "2026-02-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
  });

  it("resolves provider price mappings to the exact grandfathered version", async () => {
    const registry = new InMemoryPlanRegistry([grandfathered, current]);

    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "polar-pro",
        priceIds: ["price-pro-v1"],
      }),
    ).resolves.toMatchObject({ ref: grandfathered.ref });
  });

  it("matches the complete set of provider prices for multi-price subscriptions", async () => {
    const multiPrice: PlanVersionDefinition = {
      ...grandfathered,
      providerBindings: [
        ...grandfathered.providerBindings,
        {
          provider: "polar",
          productId: "polar-pro",
          priceId: "price-pro-metered",
        },
      ],
    };
    const registry = new InMemoryPlanRegistry([multiPrice]);

    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "polar-pro",
        priceIds: ["price-pro-metered", "price-pro-v1"],
      }),
    ).resolves.toMatchObject({ ref: grandfathered.ref });
    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "polar-pro",
        priceIds: ["price-pro-v1"],
      }),
    ).rejects.toBeInstanceOf(UnknownPlanVersionMappingProblem);
  });

  it("fails with a stable public Problem for missing or ambiguous provider mappings", async () => {
    const registry = new InMemoryPlanRegistry([grandfathered, current]);

    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "missing",
      }),
    ).rejects.toMatchObject({
      code: "billing/unknown-plan-version-mapping",
    });
    await expect(
      registry.resolveProviderPlanVersion({
        provider: "polar",
        productId: "polar-pro",
      }),
    ).rejects.toBeInstanceOf(UnknownPlanVersionMappingProblem);
  });

  it("rejects invalid or colliding provider mappings when versions are published", async () => {
    const registry = new InMemoryPlanRegistry([grandfathered]);

    await expect(
      registry.publishPlanVersion({
        ...current,
        providerBindings: [{ provider: "", productId: "polar-pro", priceId: "price-pro-v2" }],
      }),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
    await expect(
      registry.publishPlanVersion({
        ...current,
        providerBindings: [...grandfathered.providerBindings],
      }),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);
  });

  it("uses only JSON-serializable values in the published definition", async () => {
    const registry = new InMemoryPlanRegistry([grandfathered]);
    const published = await registry.getPlanVersion(grandfathered.ref);

    expect(JSON.parse(JSON.stringify(published))).toEqual(published);
  });
});
