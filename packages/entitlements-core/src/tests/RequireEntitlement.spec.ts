import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_REQUIRED_KEY,
  RequireEntitlement,
} from "../libs/decorators/RequireEntitlement";
import { getEntitlementRequirements } from "../libs/EntitlementRequirement";

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
});
