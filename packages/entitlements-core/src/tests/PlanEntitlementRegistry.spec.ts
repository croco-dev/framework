import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryPlanEntitlementRegistry } from "../libs/InMemoryPlanEntitlementRegistry";
import type { EntitlementRule } from "../libs/types";

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
});
