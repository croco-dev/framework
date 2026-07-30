import { planVersionRef } from "@croco/billing-core";
import { defineMeter } from "@croco/metering-core";
import { describe, expectTypeOf, it } from "vitest";
import {
  defineFeature,
  definePlanEntitlements,
  type FeatureRef,
} from "../libs/EntitlementDefinition";

const REPORTS = defineFeature("reports");
const LOCAL_REPORTS = defineMeter({
  key: "reports.local",
  aggregation: "COUNT",
  unit: "report",
});
const BILLABLE_REPORTS = defineMeter({
  key: "reports.billable",
  aggregation: "COUNT",
  unit: "report",
  billing: "required",
});

describe("entitlement definition types", () => {
  it("preserves literal feature keys and accepts billing-bound overage", () => {
    expectTypeOf(REPORTS).toEqualTypeOf<FeatureRef<"reports">>();

    const definition = definePlanEntitlements({
      planId: "pro",
      planVersionRef: planVersionRef("pro@2026-01"),
      entitlements: [
        {
          feature: REPORTS,
          type: "metered",
          meter: BILLABLE_REPORTS,
          quota: 100,
          overagePolicy: "ALLOW_WITH_OVERAGE",
        },
      ],
    });
    expectTypeOf(definition.planVersionRef).toEqualTypeOf<ReturnType<typeof planVersionRef>>();
  });
});

function compileOnlyInvalidDefinitions(): void {
  definePlanEntitlements({
    planId: "pro",
    planVersionRef: planVersionRef("pro@2026-01"),
    entitlements: [
      {
        feature: REPORTS,
        type: "metered",
        // @ts-expect-error billable overage rejects local meters
        meter: LOCAL_REPORTS,
        quota: 100,
        overagePolicy: "ALLOW_WITH_OVERAGE",
      },
    ],
  });

  definePlanEntitlements({
    planId: "pro",
    planVersionRef: planVersionRef("pro@2026-01"),
    entitlements: [
      {
        feature: REPORTS,
        type: "static",
        // @ts-expect-error static entitlements require a numeric value
        value: undefined,
      },
    ],
  });

  definePlanEntitlements({
    planId: "pro",
    planVersionRef: planVersionRef("pro@2026-01"),
    entitlements: [
      {
        feature: REPORTS,
        type: "boolean",
        // @ts-expect-error boolean entitlements cannot bind meters
        meter: BILLABLE_REPORTS,
      },
    ],
  });

  definePlanEntitlements({
    planId: "pro",
    planVersionRef: planVersionRef("pro@2026-01"),
    entitlements: [
      // @ts-expect-error version-bound metered entitlements require an inline quota
      {
        feature: REPORTS,
        type: "metered",
        meter: BILLABLE_REPORTS,
        overagePolicy: "ALLOW_WITH_OVERAGE",
      },
    ],
  });
}

void compileOnlyInvalidDefinitions;
