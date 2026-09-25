import { describe, expect, it } from "vitest";
import { Problem, ProblemCategory, readExplicitRetryability } from "../index";

class ProviderProblem extends Problem {
  constructor(category: ProblemCategory, retryable?: boolean) {
    super(
      "problems-core/test-provider-failure",
      category,
      "Provider failed",
      retryable === undefined ? undefined : { extensions: { retryable } },
    );
  }
}

function withThrowingGetter<T extends object>(target: T, property: string): T {
  return Object.defineProperty(target, property, {
    get: () => {
      throw new Error(`unreadable ${property}`);
    },
  });
}

describe("readExplicitRetryability", () => {
  it.each([
    { category: ProblemCategory.InternalServerError, retryable: false },
    { category: ProblemCategory.Conflict, retryable: true },
  ])(
    "reads extensions.retryable=$retryable from a $category Problem",
    ({ category, retryable }) => {
      expect(readExplicitRetryability(new ProviderProblem(category, retryable))).toBe(retryable);
    },
  );

  it.each([true, false])("prefers top-level retryable=%s over extensions", (retryable) => {
    const problem = Object.assign(
      new ProviderProblem(ProblemCategory.InternalServerError, !retryable),
      {
        retryable,
      },
    );

    expect(readExplicitRetryability(problem)).toBe(retryable);
  });

  it("reads extensions.retryable from a Problem-shaped object that is not a Problem instance", () => {
    expect(
      readExplicitRetryability({ code: "TERMINAL", status: 503, extensions: { retryable: false } }),
    ).toBe(false);
  });

  it.each([undefined, null, "false", 0, 1])(
    "ignores a non-boolean top-level retryable (%s) and falls back to extensions",
    (retryable) => {
      expect(readExplicitRetryability({ retryable, extensions: { retryable: false } })).toBe(false);
      expect(readExplicitRetryability({ retryable })).toBeUndefined();
    },
  );

  it("returns undefined when no explicit classification exists", () => {
    expect(
      readExplicitRetryability(new ProviderProblem(ProblemCategory.InternalServerError)),
    ).toBeUndefined();
    expect(readExplicitRetryability(new Error("connection reset"))).toBeUndefined();
    expect(readExplicitRetryability({ extensions: { retryable: "true" } })).toBeUndefined();
    expect(readExplicitRetryability({ extensions: null })).toBeUndefined();
  });

  it.each([undefined, null, "retryable", 503, true])(
    "returns undefined for the non-object value %s",
    (error) => {
      expect(readExplicitRetryability(error)).toBeUndefined();
    },
  );

  it("reads a classification declared on a thrown function", () => {
    expect(readExplicitRetryability(Object.assign(() => undefined, { retryable: false }))).toBe(
      false,
    );
  });

  it("treats a throwing retryable accessor as undeclared and still reads extensions", () => {
    const problem = withThrowingGetter(
      new ProviderProblem(ProblemCategory.InternalServerError, false),
      "retryable",
    );

    expect(readExplicitRetryability(problem)).toBe(false);
  });

  it("treats throwing extensions accessors as undeclared", () => {
    expect(
      readExplicitRetryability(withThrowingGetter(new Error("unavailable"), "extensions")),
    ).toBeUndefined();
    expect(
      readExplicitRetryability({ extensions: withThrowingGetter({}, "retryable") }),
    ).toBeUndefined();
  });
});
