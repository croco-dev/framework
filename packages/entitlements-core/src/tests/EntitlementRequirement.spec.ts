import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_REQUIREMENTS_KEY,
  getEntitlementRequirements,
} from "../libs/EntitlementRequirement";

describe("EntitlementRequirement", () => {
  it("should ignore malformed resource metadata instead of throwing", () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(
      ENTITLEMENT_REQUIREMENTS_KEY,
      [
        {
          feature: "reports.export",
          resource: { type: 42 },
        },
        {
          feature: "reports.read",
          resource: { type: "report", idParam: "id" },
        },
      ],
      TestController,
      "testMethod",
    );

    expect(getEntitlementRequirements(TestController, "testMethod")).toEqual([
      {
        feature: "reports.read",
        resource: { type: "report", idParam: "id" },
        ruleId: "entitlement:reports.read",
      },
    ]);
  });
});
