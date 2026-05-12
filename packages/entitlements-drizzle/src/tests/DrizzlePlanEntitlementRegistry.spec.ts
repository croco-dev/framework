import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @croco/entitlements-core to prevent @Inject decorator execution during import
vi.mock("@croco/entitlements-core", () => ({
  PlanEntitlementRegistry: class {},
}));

import {
  type DrizzleEntitlementsClient,
  DrizzlePlanEntitlementRegistry,
} from "../libs/DrizzlePlanEntitlementRegistry";

describe("DrizzlePlanEntitlementRegistry", () => {
  let registry!: DrizzlePlanEntitlementRegistry;
  let mockDb!: {
    select: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const mockQueryBuilder = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };

    mockDb = {
      select: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    registry = new DrizzlePlanEntitlementRegistry(mockDb as unknown as DrizzleEntitlementsClient);
  });

  it("should get entitlements by planId", async () => {
    const mockEntitlements = [
      {
        featureKey: "projects",
        type: "metered",
        quota: 10,
        value: null,
        meterId: "meter-1",
        overagePolicy: "block",
      },
      {
        featureKey: "teams",
        type: "static",
        value: 3,
        quota: null,
        meterId: null,
        overagePolicy: null,
      },
    ];

    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockEntitlements),
      }),
    });

    const result = await registry.getEntitlements("free-plan");
    expect(result).toHaveLength(2);
    expect(result[0].featureKey).toBe("projects");
    expect(result[0].type).toBe("metered");
    expect(result[0].quota).toBe(10);
    expect(result[1].featureKey).toBe("teams");
    expect(result[1].type).toBe("static");
    expect(result[1].value).toBe(3);
  });

  it("should return empty array for unknown plan", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await registry.getEntitlements("unknown-plan");
    expect(result).toEqual([]);
  });

  it("should find rule by featureKey", async () => {
    const mockEntitlements = [
      {
        featureKey: "projects",
        type: "metered",
        quota: 10,
        value: null,
        meterId: "meter-1",
        overagePolicy: "block",
      },
      {
        featureKey: "teams",
        type: "static",
        value: 3,
        quota: null,
        meterId: null,
        overagePolicy: null,
      },
    ];

    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockEntitlements),
      }),
    });

    const rule = await registry.findRule("free-plan", "teams");
    expect(rule).toBeDefined();
    expect(rule?.featureKey).toBe("teams");
    expect(rule?.type).toBe("static");
    expect(rule?.value).toBe(3);
  });

  it("should return null for unknown featureKey", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const rule = await registry.findRule("free-plan", "unknown");
    expect(rule).toBeNull();
  });

  it("should return null for unknown planId in findRule", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const rule = await registry.findRule("unknown-plan", "projects");
    expect(rule).toBeNull();
  });
});
