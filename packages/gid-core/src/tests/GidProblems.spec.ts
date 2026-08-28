import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { DuplicateIdPrefixProblem, InvalidIdPrefixProblem } from "../libs/problems/GidProblems";

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

  it("DuplicateIdPrefixProblem identifies only the conflicting prefix and keys", () => {
    const problem = new DuplicateIdPrefixProblem("usr", "USER", "ACCOUNT");

    expect(problem.code).toBe("gid-core/duplicate-prefix");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe("GID prefix 'usr' is configured for both 'USER' and 'ACCOUNT'.");
    expect(problem.extensions).toEqual({
      prefix: "usr",
      firstKey: "USER",
      duplicateKey: "ACCOUNT",
      retryable: false,
    });
  });
});
