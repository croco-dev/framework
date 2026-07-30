import { planVersionRef } from "@croco/billing-core";
import { defineMeter } from "@croco/metering-core";
import { describe, expect, it } from "vitest";
import {
  defineFeature,
  definePlanEntitlements,
  legacyPlanVersionRef,
  migrateLegacyPlanEntitlements,
} from "../libs/EntitlementDefinition";
import { EntitlementDefinitionProblem } from "../libs/problems/EntitlementProblems";

const REPORTS = defineFeature("reports");
const BILLABLE_REPORTS = defineMeter({
  key: "reports.generated",
  aggregation: "COUNT",
  unit: "report",
  billing: "required",
});

describe("entitlement definitions", () => {
  it("normalizes typed references into a deterministic descriptor", () => {
    const definition = definePlanEntitlements({
      planId: "pro",
      planVersionRef: planVersionRef("pro@2026-01"),
      entitlements: [
        { feature: defineFeature("teams"), type: "static", value: 3 },
        {
          feature: REPORTS,
          type: "metered",
          meter: BILLABLE_REPORTS,
          quota: 100,
          overagePolicy: "ALLOW_WITH_OVERAGE",
        },
      ],
    });

    expect(JSON.stringify(definition)).toBe(
      '{"planId":"pro","planVersionRef":"pro@2026-01","entitlements":[{"featureKey":"teams","type":"static","value":3},{"featureKey":"reports","type":"metered","meterId":"reports.generated","meterBilling":"required","quota":100,"overagePolicy":"ALLOW_WITH_OVERAGE"}]}',
    );
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.entitlements)).toBe(true);
  });

  it("rejects billable overage without a billing-required meter at runtime", () => {
    expect(() =>
      definePlanEntitlements({
        planId: "pro",
        planVersionRef: planVersionRef("pro@2026-01"),
        entitlements: [
          {
            feature: REPORTS,
            type: "metered",
            meter: "reports.generated",
            quota: 100,
            overagePolicy: "ALLOW_WITH_OVERAGE",
          },
        ],
      } as never),
    ).toThrow(EntitlementDefinitionProblem);
  });

  it("migrates a legacy plan only to an explicitly selected published reference", () => {
    const migrated = migrateLegacyPlanEntitlements(
      {
        planId: "pro",
        entitlements: [{ featureKey: "reports", type: "metered", quota: 10 }],
      },
      planVersionRef("pro@2026-01"),
    );

    expect(migrated).toMatchObject({
      planId: "pro",
      planVersionRef: "pro@2026-01",
      entitlements: [{ featureKey: "reports", quota: 10 }],
    });
    expect(() =>
      migrateLegacyPlanEntitlements(
        { planId: "pro", entitlements: [] },
        legacyPlanVersionRef("pro"),
      ),
    ).toThrow(EntitlementDefinitionProblem);
  });

  it("rejects legacy rules that remain dependent on mutable quota state", () => {
    expect(() =>
      migrateLegacyPlanEntitlements(
        {
          planId: "pro",
          entitlements: [
            {
              featureKey: "reports",
              type: "metered",
              meterId: "reports.generated",
            },
          ],
        },
        planVersionRef("pro@2026-01"),
      ),
    ).toThrow("requires an inline quota");
  });
});
