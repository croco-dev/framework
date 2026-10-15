import { describe, it, expect } from "vitest";
import { validateSurveyAdminAccess } from "../libs/surveyOperations";
describe("survey admin context", () => {
  it("requires a tenant even when operator permissions exist", () => {
    expect(() =>
      validateSurveyAdminAccess({
        scope: { tenantId: "", appId: "app", environmentId: "test" },
        actor: "operator",
        permissions: ["publish", "read", "raw"],
      }),
    ).toThrow();
  });
});
