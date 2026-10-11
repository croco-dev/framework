import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { TenantRequiredProblem } from "../libs/problems/TenantRequiredProblem";

describe("TenantRequiredProblem", () => {
  it("should expose the operation in the response detail", () => {
    const problem = new TenantRequiredProblem("deleteUser");

    expect(problem.code).toBe("tenant/required");
    expect(problem.category).toBe(ProblemCategory.Unauthorized);
    expect(problem.detail).toBe("Tenant context is required for: deleteUser");
    expect(problem.toJSON()).toMatchObject({
      code: "tenant/required",
      detail: "Tenant context is required for: deleteUser",
      status: 401,
    });
  });

  it("should fall back to a generic detail without an operation", () => {
    const problem = new TenantRequiredProblem();

    expect(problem.toJSON()).toMatchObject({
      code: "tenant/required",
      detail: "Tenant context is required",
      status: 401,
    });
  });
});
