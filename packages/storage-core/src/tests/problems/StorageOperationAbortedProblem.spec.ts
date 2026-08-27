import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { StorageOperationAbortedProblem } from "../../libs/problems/StorageOperationAbortedProblem";

describe("StorageOperationAbortedProblem", () => {
  it("취소 원인과 연산 evidence를 보존함", () => {
    const cause = new Error("shutdown deadline reached");
    const problem = new StorageOperationAbortedProblem("getMetadata", "files/report.pdf", cause);

    expect(problem.code).toBe("STORAGE_OPERATION_ABORTED");
    expect(problem.category).toBe(ProblemCategory.BadRequest);
    expect(problem.cause).toBe(cause);
    expect(problem.extensions).toEqual({
      key: "files/report.pdf",
      operation: "getMetadata",
    });
    expect(problem.detail).toBe(
      "Storage operation 'getMetadata' was aborted for key 'files/report.pdf'",
    );
  });
});
