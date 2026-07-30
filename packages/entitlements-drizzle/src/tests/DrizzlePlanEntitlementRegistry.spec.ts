import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { planVersionRef } from "@croco/billing-core";

// Mock @croco/entitlements-core to prevent @Inject decorator execution during import
vi.mock("@croco/entitlements-core", () => ({
  PlanEntitlementRegistry: class {},
  getLegacyPlanId: (ref: string) =>
    ref.startsWith("legacy:") ? ref.slice("legacy:".length) : null,
  EntitlementPlanVersionNotFoundProblem: class extends Error {
    readonly code = "entitlements-core/plan-version-not-found";
    readonly status = 404;
  },
  EntitlementDefinitionProblem: class extends Error {
    readonly code = "entitlements-core/definition-invalid";
    readonly status = 400;
  },
  EntitlementPlanVersionMismatchProblem: class extends Error {
    readonly code = "entitlements-core/plan-version-mismatch";
    readonly status = 409;
  },
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

  it("queries entitlement rules by immutable plan version", async () => {
    const rows = [
      {
        planId: "pro",
        planVersionRef: "pro@2026-01",
        featureKey: "reports",
        type: "metered",
        quota: 10,
        value: null,
        meterId: "reports.generated",
        meterBilling: "required",
        overagePolicy: "allow",
      },
    ];
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ planId: "pro", planVersionRef: "pro@2026-01" }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      });

    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("pro@2026-01")),
    ).resolves.toEqual([
      {
        featureKey: "reports",
        type: "metered",
        value: undefined,
        meterId: "reports.generated",
        meterBilling: "required",
        quota: 10,
        overagePolicy: "ALLOW_WITH_OVERAGE",
      },
    ]);
  });

  it("fails with a stable Problem when the plan version set is unknown", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("pro@missing")),
    ).rejects.toMatchObject({
      code: "entitlements-core/plan-version-not-found",
      status: 404,
    });
  });

  it("rejects persisted billable overage without a required meter binding", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ planId: "pro", planVersionRef: "pro@2026-01" }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              planId: "pro",
              planVersionRef: "pro@2026-01",
              featureKey: "reports",
              type: "metered",
              quota: 10,
              value: null,
              meterId: "reports.generated",
              meterBilling: null,
              overagePolicy: "allow",
            },
          ]),
        }),
      });

    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("pro@2026-01")),
    ).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
      status: 400,
    });
  });

  it("rejects a plan version owned by a different plan family", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockResolvedValue([{ planId: "enterprise", planVersionRef: "enterprise@2026-01" }]),
      }),
    });

    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("enterprise@2026-01"), "pro"),
    ).rejects.toMatchObject({
      code: "entitlements-core/plan-version-mismatch",
      status: 409,
    });
  });

  it("rejects corrupt persisted rule discriminants", async () => {
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ planId: "pro", planVersionRef: "pro@2026-01" }]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              planId: "pro",
              planVersionRef: "pro@2026-01",
              featureKey: "reports",
              type: "surprise",
              quota: 10,
              value: null,
              meterId: null,
              meterBilling: null,
              overagePolicy: "block",
            },
          ]),
        }),
      });

    await expect(
      registry.getEntitlementsByPlanVersion(planVersionRef("pro@2026-01")),
    ).rejects.toMatchObject({
      code: "entitlements-core/definition-invalid",
      status: 400,
    });
  });
});
