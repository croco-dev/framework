import { getTableColumns } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { planVersionRef } from "@croco/billing-core";
import {
  EntitlementPlanVersionMismatchProblem,
  InMemoryPlanEntitlementRegistry,
  PlanEntitlementRegistry,
} from "@croco/entitlements-core";
import { Container } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";
import { DrizzleHealthIndicator } from "@croco/tx-drizzle";
import { DrizzlePlanEntitlementRegistry } from "../libs/DrizzlePlanEntitlementRegistry";
import { planEntitlements, planEntitlementSets } from "../libs/schema";
import type { EntitlementRule } from "@croco/entitlements-core";

type DrizzleEntitlementsClient = ConstructorParameters<typeof DrizzlePlanEntitlementRegistry>[0];

const entitlementRow = {
  id: "rule-1",
  planId: "pro",
  featureKey: "seats",
  type: "metered",
  value: null,
  meterId: "seat_count",
  meterBilling: null,
  quota: 10,
  overagePolicy: "block",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function createReadinessCheck(providerName: string) {
  return {
    name: "redacts database connection details from readiness failures",
    run: async () => {
      const detail =
        `failed postgres://${providerName}:provider-secret@db.example/app?password=query-secret` +
        " token=raw-token";
      const indicator = new DrizzleHealthIndicator(
        {
          transaction: vi
            .fn()
            .mockRejectedValue(
              ProblemFactory.internalServerError("testing/drizzle-readiness-failed", detail),
            ),
        } as never,
        { name: providerName },
      );
      const health = await indicator.check();
      const serialized = JSON.stringify(health);

      expect(health.status).toBe("down");
      expect(serialized).not.toContain("provider-secret");
      expect(serialized).not.toContain("query-secret");
      expect(serialized).not.toContain("raw-token");
      expect(health.details?.error).toBe(
        "failed postgres://[redacted]@db.example/app?password=[redacted] token=[redacted]",
      );
    },
  };
}

function createSelectClient(rows: unknown[]): DrizzleEntitlementsClient {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as unknown as DrizzleEntitlementsClient;
}

describe("entitlements-drizzle provider conformance", () => {
  it.each(
    createDrizzleProviderConformanceSuite({
      providerName: "entitlements-drizzle",
      schema: {
        supported: true,
        checks: [
          {
            name: "declares plan entitlement rule columns",
            run: async () => {
              const columns = getTableColumns(planEntitlements);

              expect(Object.keys(columns)).toEqual(
                expect.arrayContaining([
                  "id",
                  "planId",
                  "planVersionRef",
                  "featureKey",
                  "type",
                  "meterId",
                  "meterBilling",
                  "quota",
                  "overagePolicy",
                ]),
              );
              expect(Object.keys(getTableColumns(planEntitlementSets))).toEqual(
                expect.arrayContaining(["planVersionRef", "planId"]),
              );
            },
          },
        ],
      },
      diagnostics: {
        supported: true,
        checks: [createReadinessCheck("entitlements-drizzle")],
      },
      transaction: {
        participation: {
          supported: false,
          reason:
            "DrizzlePlanEntitlementRegistry accepts a direct Drizzle client and no TxManager.",
        },
        rollback: {
          supported: false,
          reason: "Rollback is owned by the app-level Drizzle transaction boundary.",
        },
      },
      tenantIsolation: {
        supported: false,
        reason: "Plan entitlement rules are plan-scoped and have no tenantId field.",
      },
      repositoryErrors: {
        notFound: {
          supported: true,
          checks: [
            {
              name: "returns null when a plan feature rule is absent",
              run: async () => {
                const registry = new DrizzlePlanEntitlementRegistry(createSelectClient([]));

                await expect(registry.findRule("pro", "missing-feature")).resolves.toBeNull();
              },
            },
          ],
        },
        validation: {
          supported: false,
          reason: "Entitlement rule validation is enforced by entitlements-core.",
        },
        duplicate: {
          supported: false,
          reason: "Plan entitlement rule writes are not exposed by this read-only registry.",
        },
        conflict: {
          supported: false,
          reason: "The read-only registry has no mutable conflict boundary.",
        },
        retryableFailure: {
          supported: false,
          reason:
            "Retryable database failures are exposed through the app-level Drizzle health indicator.",
        },
      },
    }).cases,
  )("$name", async ({ run }) => {
    await run();
  });

  it("maps Drizzle entitlement rows through the public registry contract", async () => {
    const registry = new DrizzlePlanEntitlementRegistry(createSelectClient([entitlementRow]));

    await expect(registry.getEntitlements("pro")).resolves.toEqual([
      {
        featureKey: "seats",
        type: "metered",
        value: undefined,
        meterId: "seat_count",
        meterBilling: undefined,
        quota: 10,
        overagePolicy: "BLOCK",
      },
    ]);
  });
});

const rules: EntitlementRule[] = [
  { featureKey: "seats", type: "static", value: 7 },
  { featureKey: "storage", type: "metered", meterId: "storage" },
];
const ref = planVersionRef("legacy:plan-a");

class LegacyRegistry extends PlanEntitlementRegistry {
  async getEntitlements(planId: string): Promise<EntitlementRule[]> {
    return planId === "plan-a" ? rules : [];
  }

  async findRule(planId: string, featureKey: string): Promise<EntitlementRule | null> {
    return (
      (await this.getEntitlements(planId)).find((rule) => rule.featureKey === featureKey) ?? null
    );
  }
}

describe.each([
  { name: "base fallback", create: () => new LegacyRegistry() },
  {
    name: "InMemory",
    create: () => {
      const registry = new InMemoryPlanEntitlementRegistry();
      registry.register("plan-a", rules);
      return registry;
    },
  },
  {
    name: "Drizzle",
    create: () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(
              rules.map((rule) => ({
                ...rule,
                planId: "plan-a",
                planVersionRef: null,
                value: rule.value ?? null,
                quota: null,
                meterId: rule.meterId ?? null,
                meterBilling: null,
                overagePolicy: null,
              })),
            ),
          }),
        }),
      };
      return new DrizzlePlanEntitlementRegistry(db as unknown as DrizzleEntitlementsClient);
    },
  },
])("Legacy plan reference: $name", ({ create }) => {
  let registry: PlanEntitlementRegistry;

  beforeEach(() => {
    Container.reset();
    registry = create();
  });

  it.each(["plan-b", ""])(
    "rejects expected plan %j and permits a corrected retry",
    async (expectedPlanId) => {
      for (const lookup of [
        () => registry.getEntitlementsByPlanVersion(ref, expectedPlanId),
        () => registry.findRuleByPlanVersion(ref, "seats", expectedPlanId),
        () => registry.findRuleByPlanVersion(ref, "missing", expectedPlanId),
      ]) {
        const result = lookup();
        await expect(result).rejects.toBeInstanceOf(EntitlementPlanVersionMismatchProblem);
        await expect(result).rejects.toMatchObject({
          code: "entitlements-core/plan-version-mismatch",
          status: 409,
          detail: `Plan version 'legacy:plan-a' belongs to 'plan-a', not '${expectedPlanId}'`,
        });
      }

      await expect(registry.findRuleByPlanVersion(ref, "seats", "plan-a")).resolves.toMatchObject({
        value: 7,
      });
    },
  );

  it.each(["plan-a", undefined])(
    "preserves legacy rules with expected plan %j",
    async (expectedPlanId) => {
      await expect(registry.getEntitlementsByPlanVersion(ref, expectedPlanId)).resolves.toEqual([
        expect.objectContaining(rules[0]),
        expect.objectContaining(rules[1]),
      ]);
      await expect(
        registry.findRuleByPlanVersion(ref, "seats", expectedPlanId),
      ).resolves.toMatchObject({
        value: 7,
      });
      await expect(
        registry.findRuleByPlanVersion(ref, "missing", expectedPlanId),
      ).resolves.toBeNull();
    },
  );
});
