import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  ConfigSchemaNotFoundProblem,
  RuntimeEnvPresetBoundaryProblem,
} from "../libs/problems/ConfigProblems";

describe("ConfigProblems", () => {
  it("ConfigSchemaNotFoundProblem has correct code and category", () => {
    const problem = new ConfigSchemaNotFoundProblem("AppConfig");

    expect(problem.code).toBe("framework-config/config-schema-not-found");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("No config schema found for 'AppConfig'");
  });

  it("RuntimeEnvPresetBoundaryProblem describes the violated exposure boundary", () => {
    const problem = new RuntimeEnvPresetBoundaryProblem("client", "PUBLIC_API_URL");

    expect(problem.code).toBe("framework-config/runtime-env-preset-boundary");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe(
      "Invalid client env 'PUBLIC_API_URL': client variables must use the 'NEXT_PUBLIC_' prefix",
    );
  });
});
