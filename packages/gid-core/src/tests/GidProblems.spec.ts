import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { InvalidIdPrefixProblem } from "../libs/problems/GidProblems";

describe("GidProblems", () => {
  it("InvalidIdPrefixProblem preserves the compatible length constructor", () => {
    const problem = new InvalidIdPrefixProblem(2, 3);

    expect(problem.code).toBe("gid-core/invalid-id-prefix");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe(
      "Prefix must contain between 3 and 32 characters, but received length 2.",
    );
    expect(problem.extensions).toEqual({
      reason: "invalid-length",
      length: 2,
      minimumLength: 3,
      maximumLength: 32,
      grammar: "^[a-z0-9]{3,32}$",
      retryable: false,
    });
  });
});
