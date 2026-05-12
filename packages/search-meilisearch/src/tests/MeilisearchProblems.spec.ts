import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { TenantTokenNotConfiguredProblem } from "../libs/problems/MeilisearchProblems";

describe("MeilisearchProblems", () => {
  it("TenantTokenNotConfiguredProblem has correct code and category", () => {
    const problem = new TenantTokenNotConfiguredProblem();

    expect(problem.code).toBe("search-meilisearch/tenant-token-not-configured");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Tenant token options are not configured");
  });
});
