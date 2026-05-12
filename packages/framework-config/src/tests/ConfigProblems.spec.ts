import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { ConfigSchemaNotFoundProblem } from "../libs/problems/ConfigProblems";

describe("ConfigProblems", () => {
  it("ConfigSchemaNotFoundProblem has correct code and category", () => {
    const problem = new ConfigSchemaNotFoundProblem("AppConfig");

    expect(problem.code).toBe("framework-config/config-schema-not-found");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("No config schema found for 'AppConfig'");
  });
});
