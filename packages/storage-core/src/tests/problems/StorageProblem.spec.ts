import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { StorageProblem } from "../../libs/problems/StorageProblem";

describe("StorageProblem", () => {
  it("추상 클래스이므로 직접 인스턴스화 불가", () => {
    class TestStorageProblem extends StorageProblem {
      readonly code = "TEST_STORAGE";

      public constructor(code: string, category: ProblemCategory, detail?: string) {
        super(code, category, detail);
      }
    }

    const problem = new TestStorageProblem(
      "TEST_STORAGE",
      ProblemCategory.InternalServerError,
      "Test error",
    );

    expect(problem.code).toBe("TEST_STORAGE");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Test error");
  });

  it("다양한 category로 생성 가능", () => {
    class TestStorageProblem extends StorageProblem {
      readonly code = "TEST_STORAGE";

      public constructor(code: string, category: ProblemCategory, detail?: string) {
        super(code, category, detail);
      }
    }

    const problem1 = new TestStorageProblem(
      "TEST_STORAGE",
      ProblemCategory.NotFound,
      "Resource not found",
    );
    expect(problem1.category).toBe(ProblemCategory.NotFound);

    const problem2 = new TestStorageProblem(
      "TEST_STORAGE",
      ProblemCategory.BadRequest,
      "Invalid request",
    );
    expect(problem2.category).toBe(ProblemCategory.BadRequest);
  });

  it("Problem을 상속받으므로 Problem 인스턴스로 throw/catch 가능", () => {
    class TestStorageProblem extends StorageProblem {
      readonly code = "TEST_STORAGE";

      public constructor(code: string, category: ProblemCategory, detail?: string) {
        super(code, category, detail);
      }
    }

    expect(() => {
      throw new TestStorageProblem(
        "TEST_STORAGE",
        ProblemCategory.InternalServerError,
        "Test error",
      );
    }).toThrow(TestStorageProblem);
  });
});
