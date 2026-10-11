import "reflect-metadata";
import { buildContractGraph } from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_REQUIRED_KEY,
  RequireEntitlement,
} from "../libs/decorators/RequireEntitlement";
import { getEntitlementRequirements } from "../libs/EntitlementRequirement";
import { defineFeature } from "../libs/EntitlementDefinition";

describe("RequireEntitlement", () => {
  it("should store entitlement policy metadata with source location", () => {
    class TestController {
      @RequireEntitlement({ feature: "audit_logs" })
      testMethod() {}
    }

    const legacyMetadata = Reflect.getMetadata(
      ENTITLEMENT_REQUIRED_KEY,
      TestController,
      "testMethod",
    );
    const [metadata] = getEntitlementRequirements(TestController, "testMethod");

    expect(legacyMetadata).toBe("audit_logs");
    expect(metadata).toMatchObject({
      feature: "audit_logs",
      ruleId: "entitlement:audit_logs",
      sourceLocation: {
        file: expect.stringContaining("RequireEntitlement.spec.ts"),
        line: expect.any(Number),
      },
    });
  });

  it("serializes typed feature references as stable string metadata", () => {
    const REPORTS = defineFeature("reports.export");

    class TestController {
      @RequireEntitlement({ feature: REPORTS })
      exportReports() {}
    }

    expect(getEntitlementRequirements(TestController, "exportReports")).toMatchObject([
      {
        feature: "reports.export",
        ruleId: "entitlement:reports.export",
      },
    ]);
  });
});

describe("RequireEntitlement inheritance", () => {
  @RequireEntitlement({ feature: "api-access" })
  class TenantApiController {
    list() {}
  }

  class PlainChildController extends TenantApiController {}

  @RequireEntitlement({ feature: "reports" })
  class ReportsController extends TenantApiController {}

  @RequireEntitlement({ feature: "billing" })
  class BillingController extends TenantApiController {}

  class BaseMethodController {
    @RequireEntitlement({ feature: "api-access" })
    list() {}
  }

  class OverridingMethodController extends BaseMethodController {
    @RequireEntitlement({ feature: "reports" })
    override list() {}
  }

  const features = (target: unknown) =>
    getEntitlementRequirements(target, "list").map((requirement) => requirement.feature);

  it("inherits base class requirements on an undecorated subclass", () => {
    expect(features(PlainChildController)).toEqual(["api-access"]);
  });

  it("keeps base class requirements when a subclass declares its own", () => {
    expect(features(ReportsController)).toEqual(["api-access", "reports"]);
  });

  it("keeps base method requirements when an override declares its own", () => {
    expect(features(OverridingMethodController)).toEqual(["api-access", "reports"]);
  });

  it("does not leak subclass requirements into the base class or siblings", () => {
    expect(features(TenantApiController)).toEqual(["api-access"]);
    expect(features(BaseMethodController)).toEqual(["api-access"]);
    expect(features(BillingController)).toEqual(["api-access", "billing"]);
  });

  it("accumulates stacked declarations through multiple inheritance levels once", () => {
    @RequireEntitlement({ feature: "export" })
    @RequireEntitlement({ feature: "reports" })
    class ReportsExportController extends TenantApiController {}

    @RequireEntitlement({ feature: "scheduled-export" })
    class ScheduledExportController extends ReportsExportController {}

    expect(features(ScheduledExportController)).toEqual([
      "api-access",
      "reports",
      "export",
      "scheduled-export",
    ]);
    expect(features(ReportsExportController)).toEqual(["api-access", "reports", "export"]);
  });

  it.each([undefined, "list"])(
    "keeps inherited legacy requirements at metadata property %s",
    (propertyKey) => {
      class LegacyController {
        list() {}
      }

      if (propertyKey === undefined) {
        Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, "api-access", LegacyController);
      } else {
        Reflect.defineMetadata(
          ENTITLEMENT_REQUIRED_KEY,
          "api-access",
          LegacyController,
          propertyKey,
        );
      }

      class ReportsController extends LegacyController {
        override list() {}
      }

      if (propertyKey === undefined) {
        RequireEntitlement({ feature: "reports" })(ReportsController);
      } else {
        RequireEntitlement({ feature: "reports" })(ReportsController.prototype, propertyKey, {
          value: ReportsController.prototype.list,
        });
      }

      expect(features(ReportsController)).toEqual(["api-access", "reports"]);
      expect(features(LegacyController)).toEqual(["api-access"]);
    },
  );

  it.each([
    ["class", ReportsController],
    ["overridden method", OverridingMethodController],
  ] as const)("exposes inherited %s requirements in the contract graph", (_kind, controller) => {
    Reflect.defineMetadata(
      Symbol.for("croco:rest:controller"),
      { path: "/reports", target: controller },
      controller,
    );
    Reflect.defineMetadata(
      Symbol.for("croco:rest:routes"),
      [{ method: "GET", path: "", methodName: "list" }],
      controller,
    );

    const [route] = buildContractGraph([controller]).routes;

    expect(route?.entitlements.map((requirement) => requirement.feature)).toEqual([
      "api-access",
      "reports",
    ]);
  });
});
