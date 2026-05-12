import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { TenantManagerNotRegisteredProblem } from "../libs/problems/TenantManagerNotRegisteredProblem";

describe("TenantManagerNotRegisteredProblem", () => {
  it("should create problem with expected metadata", () => {
    const problem = new TenantManagerNotRegisteredProblem("tenant-key");

    expect(problem.code).toBe("tenant-core/tenant-manager-not-registered");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
  });
});
