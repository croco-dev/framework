import { Container } from "@croco/framework-context";
import { planVersionRef } from "@croco/billing-core";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryPlanEntitlementRegistry } from "../libs/InMemoryPlanEntitlementRegistry";
import type { EntitlementRule, PlanEntitlements } from "../libs/types";

describe("InMemoryPlanEntitlementRegistry", () => {
  let registry!: InMemoryPlanEntitlementRegistry;

  beforeEach(() => {
    Container.reset();
    registry = new InMemoryPlanEntitlementRegistry();
  });

  it("should register and retrieve entitlements", async () => {
    const rules: EntitlementRule[] = [
      { featureKey: "projects", type: "metered", quota: 10 },
      { featureKey: "teams", type: "static", value: 3 },
    ];
    registry.register("free", rules);

    const result = await registry.getEntitlements("free");
    expect(result).toHaveLength(2);
    expect(result[0].featureKey).toBe("projects");
  });

  it("should return empty array for unknown plan", async () => {
    const result = await registry.getEntitlements("unknown");
    expect(result).toEqual([]);
  });

  it("should find rule by featureKey", async () => {
    const rules: EntitlementRule[] = [
      { featureKey: "projects", type: "metered", quota: 10 },
      { featureKey: "teams", type: "static", value: 3 },
    ];
    registry.register("free", rules);

    const rule = await registry.findRule("free", "teams");
    expect(rule).toBeDefined();
    expect(rule?.type).toBe("static");
    expect(rule?.value).toBe(3);
  });

  it("should return null for unknown featureKey", async () => {
    registry.register("free", [{ featureKey: "projects", type: "boolean" }]);
    const rule = await registry.findRule("free", "unknown");
    expect(rule).toBeNull();
  });

  it("should return null for unknown planId in findRule", async () => {
    const rule = await registry.findRule("unknown", "projects");
    expect(rule).toBeNull();
  });

  it("rejects duplicate legacy feature rules before registration", async () => {
    expect(() =>
      registry.register("pro", [
        { featureKey: "reports", type: "boolean" },
        { featureKey: "reports", type: "static", value: 10 },
      ]),
    ).toThrow("Feature 'reports' is declared more than once");

    await expect(registry.getEntitlements("pro")).resolves.toEqual([]);
  });

  it.each([
    {
      name: "static rules without a value",
      rule: { featureKey: "seats", type: "static" } as EntitlementRule,
      message: "requires a value",
    },
    {
      name: "negative metered quotas",
      rule: { featureKey: "requests", type: "metered", quota: -1 } as EntitlementRule,
      message: "finite non-negative number",
    },
    {
      name: "empty meter identifiers",
      rule: { featureKey: "requests", type: "metered", meterId: "" } as EntitlementRule,
      message: "Meter key must not be empty",
    },
    {
      name: "billable overage without a billing-required meter",
      rule: {
        featureKey: "requests",
        type: "metered",
        meterId: "requests",
        meterBilling: "local",
        overagePolicy: "ALLOW_WITH_OVERAGE",
      } as EntitlementRule,
      message: "without a billing-required meter",
    },
  ])("rejects invalid legacy $name before registration", async ({ rule, message }) => {
    expect(() => registry.register("pro", [rule])).toThrow(message);
    await expect(registry.getEntitlements("pro")).resolves.toEqual([]);
  });

  it("preserves legacy meter-derived quotas", async () => {
    registry.register("pro", [{ featureKey: "storage", type: "metered", meterId: "storage" }]);

    await expect(registry.findRule("pro", "storage")).resolves.toMatchObject({
      featureKey: "storage",
      meterId: "storage",
      type: "metered",
    });
  });

  it("keeps entitlement rules isolated by immutable plan version", async () => {
    const grandfatheredRef = planVersionRef("pro@2026-01");
    const currentRef = planVersionRef("pro@2026-07");
    registry.register({
      planId: "pro",
      planVersionRef: grandfatheredRef,
      entitlements: [{ featureKey: "reports", type: "metered", quota: 10 }],
    });
    registry.register({
      planId: "pro",
      planVersionRef: currentRef,
      entitlements: [
        {
          featureKey: "reports",
          type: "metered",
          quota: 100,
          overagePolicy: "WARN",
        },
      ],
    });

    await expect(
      registry.findRuleByPlanVersion(grandfatheredRef, "reports"),
    ).resolves.toMatchObject({ quota: 10 });
    await expect(registry.findRuleByPlanVersion(currentRef, "reports")).resolves.toMatchObject({
      quota: 100,
      overagePolicy: "WARN",
    });
  });

  it("fails with a stable Problem for an unknown plan version", async () => {
    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("pro@missing")),
    ).rejects.toMatchObject({
      code: "entitlements-core/plan-version-not-found",
      status: 404,
    });
  });

  it("rejects a plan version owned by a different plan family", async () => {
    const ref = planVersionRef("enterprise@2026-01");
    registry.register({
      planId: "enterprise",
      planVersionRef: ref,
      entitlements: [],
    });

    await expect(registry.getEntitlementsByPlanVersion(ref, "pro")).rejects.toMatchObject({
      code: "entitlements-core/plan-version-mismatch",
      status: 409,
    });
  });

  it("rejects version-bound metered rules that delegate quota to mutable state", () => {
    expect(() =>
      registry.register({
        planId: "pro",
        planVersionRef: planVersionRef("pro@2026-01"),
        entitlements: [
          {
            featureKey: "reports",
            type: "metered",
            meterId: "reports.generated",
          },
        ],
      } as unknown as PlanEntitlements),
    ).toThrow("requires an inline quota");
  });
});
