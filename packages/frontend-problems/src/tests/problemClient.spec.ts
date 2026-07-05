import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ProblemClientError,
  ProblemFetchUnavailableError,
  ProblemResponseError,
  assertProblemExhaustive,
  fetchProblemJson,
  handleJsonResult,
  isProblemDetails,
  parseProblemDetails,
  readJsonProblemResult,
  readOptionalJsonProblemResult,
  toProblemFormProblem,
  type ProblemClientResult,
  type ProblemDeclaration,
  type ProblemDetails,
  type ProblemResult,
} from "../index";

const userNotFoundProblem = {
  type: "https://docs.croco.dev/problems/user-not-found",
  title: "Not Found",
  status: 404,
  code: "USER_NOT_FOUND",
  detail: "User 1 was not found.",
  instance: "/users/1",
  traceId: "trace-1",
};

const validationProblem = {
  type: "about:blank",
  title: "Validation Error",
  status: 422,
  code: "VALIDATION_FAILED",
  detail: "Name is required.",
  fields: {
    name: ["Name is required."],
    ignored: [123],
  },
};

const declaredProblems = [
  {
    code: "USER_NOT_FOUND",
    category: "NotFound",
    status: 404,
    cookbookPath: "/reference/problem-recovery-cookbook/#user-not-found",
  },
  { code: "VALIDATION_FAILED", category: "ValidationError", status: 422 },
] as const satisfies readonly ProblemDeclaration[];

type DeclaredProblem = (typeof declaredProblems)[number];

describe("frontend Problem client runtime", () => {
  it("parses RFC 7807 Problem details while preserving extension fields", () => {
    const parsed = parseProblemDetails(userNotFoundProblem);

    expect(parsed).toBe(userNotFoundProblem);
    expect(isProblemDetails(userNotFoundProblem)).toBe(true);
    expect(parsed?.code).toBe("USER_NOT_FOUND");
    expect(parsed?.status).toBe(404);
    expect(parsed?.type).toBe("https://docs.croco.dev/problems/user-not-found");
    expect(parsed?.detail).toBe("User 1 was not found.");
    expect(parsed?.traceId).toBe("trace-1");
  });

  it("rejects incomplete Problem-like values", () => {
    expect(isProblemDetails({ title: "Not Found", status: 404, code: "MISSING_TYPE" })).toBe(false);
    expect(isProblemDetails({ ...userNotFoundProblem, status: "404" })).toBe(false);
  });

  it("returns declared Problem failures for generated-client style results", async () => {
    const result = await handleJsonResult<{ readonly id: string }, DeclaredProblem>(
      jsonResponse(userNotFoundProblem, 404),
      declaredProblems,
    );

    expect(result.ok).toBe(false);

    if (!result.ok && result.kind === "problem") {
      expect(result.code).toBe("USER_NOT_FOUND");
      expect(result.category).toBe("NotFound");
      expect(result.problem.detail).toBe("User 1 was not found.");
      expect(result.problem.traceId).toBe("trace-1");
      if (result.declaration.code === "USER_NOT_FOUND") {
        expect(result.declaration.cookbookPath).toBe(
          "/reference/problem-recovery-cookbook/#user-not-found",
        );
      } else {
        throw new Error("Expected USER_NOT_FOUND declaration.");
      }
      expectTypeOf(result.problem.code).toEqualTypeOf<"USER_NOT_FOUND" | "VALIDATION_FAILED">();
    } else {
      throw new Error("Expected declared Problem result.");
    }
  });

  it("keeps undeclared Problems external for declared generated-client results", async () => {
    const result = await handleJsonResult<{ readonly id: string }, DeclaredProblem>(
      jsonResponse({ ...userNotFoundProblem, code: "OTHER_PROBLEM" }, 404),
      declaredProblems,
    );

    expect(result.ok).toBe(false);

    if (!result.ok && result.kind === "external") {
      expect(result.error).toBeInstanceOf(ProblemClientError);
      expect(result.body).toMatchObject({ code: "OTHER_PROBLEM" });
    } else {
      throw new Error("Expected external failure for undeclared Problem.");
    }
  });

  it("returns generic Problem failures for shared fetch wrappers", async () => {
    const fetch = async () => jsonResponse(userNotFoundProblem, 404);
    const result = await fetchProblemJson<{ readonly id: string }>("/users/1", undefined, {
      fetch,
    });

    expect(result.ok).toBe(false);

    if (!result.ok && result.kind === "problem") {
      expect(result.code).toBe("USER_NOT_FOUND");
      expect(result.status).toBe(404);
      expect(result.problem.traceId).toBe("trace-1");
      expect(result.declaration).toBeUndefined();
    } else {
      throw new Error("Expected generic Problem failure.");
    }
  });

  it("distinguishes non-Problem HTTP failures from Problem failures", async () => {
    const result = await readJsonProblemResult(jsonResponse({ message: "upstream failed" }, 502));

    expect(result.ok).toBe(false);

    if (!result.ok && result.kind === "external") {
      expect(result.error).toBeInstanceOf(ProblemResponseError);
      expect(result.body).toEqual({ message: "upstream failed" });
    } else {
      throw new Error("Expected external failure.");
    }
  });

  it("returns success data and optional empty success bodies", async () => {
    await expect(
      fetchProblemJson<{ readonly id: string }>("/users/1", undefined, {
        fetch: async () => jsonResponse({ id: "1" }),
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { id: "1" },
    });

    await expect(
      readOptionalJsonProblemResult(new Response(null, { status: 204 })),
    ).resolves.toMatchObject({
      ok: true,
      data: undefined,
    });
  });

  it("throws a stable coded error when no fetch implementation is available", async () => {
    const originalFetch = globalThis.fetch;

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    try {
      const request = fetchProblemJson("/users/1");

      await expect(request).rejects.toBeInstanceOf(ProblemFetchUnavailableError);
      await expect(request).rejects.toMatchObject({
        category: ProblemCategory.InternalServerError,
        code: "frontend-problems/fetch-unavailable",
        name: "ProblemFetchUnavailableError",
        status: 500,
      });

      const error = await captureRejectedValue(request);
      expectProblemFetchUnavailableError(error);
      expect(error.toJSON()).toMatchObject({
        code: "frontend-problems/fetch-unavailable",
        status: 500,
        title: "Internal Server Error",
      });
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: originalFetch,
        writable: true,
      });
    }
  });

  it("maps declared validation Problems to form field failures", async () => {
    const result = await handleJsonResult<unknown, DeclaredProblem>(
      jsonResponse(validationProblem, 422),
      declaredProblems,
    );

    if (!result.ok && result.kind === "problem") {
      const formProblem = toProblemFormProblem<"name" | "email", DeclaredProblem>(result, [
        "name",
        "email",
      ]);

      expect(formProblem).toMatchObject({
        kind: "field-validation",
        code: "VALIDATION_FAILED",
        fields: {
          name: ["Name is required."],
        },
      });
      return;
    }

    throw new Error("Expected validation Problem result.");
  });

  it("exposes Result and Problem types for frontend consumers", () => {
    expectTypeOf<ProblemDetails<"USER_NOT_FOUND", 404>>().toHaveProperty("traceId");
    expectTypeOf<ProblemResult<{ readonly id: string }>>().toMatchTypeOf<
      | { readonly ok: true; readonly data: { readonly id: string } }
      | { readonly ok: false; readonly kind: "problem" }
      | { readonly ok: false; readonly kind: "external" }
    >();
    expectTypeOf<ProblemClientResult<{ readonly id: string }, DeclaredProblem>>().toMatchTypeOf<
      | { readonly ok: true; readonly data: { readonly id: string } }
      | { readonly ok: false; readonly kind: "problem"; readonly declaration: DeclaredProblem }
      | { readonly ok: false; readonly kind: "external" }
    >();
  });

  it("throws a stable exhaustive handling error", () => {
    expect(() => assertProblemExhaustive({ code: "UNHANDLED" } as never)).toThrow(
      "Unhandled Problem variant: UNHANDLED",
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function captureRejectedValue(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  expect.fail("Expected promise to reject.");
}

function expectProblemFetchUnavailableError(
  error: unknown,
): asserts error is ProblemFetchUnavailableError {
  expect(error).toBeInstanceOf(ProblemFetchUnavailableError);
}
