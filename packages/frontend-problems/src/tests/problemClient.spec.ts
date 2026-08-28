import { Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ProblemClientError,
  ProblemFetchUnavailableError,
  ProblemResponseError,
  ProblemStatusMismatchError,
  assertProblemExhaustive,
  fetchProblemJson,
  handleJsonResponse,
  handleJsonResult,
  isProblemDetails,
  parseProblemDetails,
  readJsonProblemResult,
  readOptionalJsonResponse,
  readOptionalJsonResult,
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

  it("rejects HTTP and Problem status mismatches for direct responses", async () => {
    const response = jsonResponse(userNotFoundProblem, 500);
    const request = handleJsonResponse(response);

    await expect(request).rejects.toBeInstanceOf(ProblemStatusMismatchError);
    await expect(request).rejects.toMatchObject({
      category: ProblemCategory.InternalServerError,
      code: "frontend-problems/status-mismatch",
      httpStatus: 500,
      name: "ProblemStatusMismatchError",
      problemCode: "USER_NOT_FOUND",
      problemStatus: 404,
      response,
      status: 500,
    });
    await expect(request).rejects.toBeInstanceOf(Problem);
    await expect(request).rejects.toThrow(
      "Problem response status mismatch for USER_NOT_FOUND: HTTP 500, Problem 404",
    );
  });

  it("preserves status-only mismatch construction for existing callers", () => {
    const response = jsonResponse(userNotFoundProblem, 500);
    const error = new ProblemStatusMismatchError(response, 404);

    expect(error).toMatchObject({
      httpStatus: 500,
      problemCode: undefined,
      problemStatus: 404,
      response,
    });
    expect(error.message).toBe("Problem response status mismatch: HTTP 500, Problem 404");
  });

  it("keeps HTTP and Problem status mismatches external for generated-client results", async () => {
    const response = jsonResponse(userNotFoundProblem, 500);
    const result = await handleJsonResult<{ readonly id: string }, DeclaredProblem>(
      response,
      declaredProblems,
    );

    expect(result).toMatchObject({
      ok: false,
      kind: "external",
      body: userNotFoundProblem,
      error: {
        category: ProblemCategory.InternalServerError,
        code: "frontend-problems/status-mismatch",
        httpStatus: 500,
        name: "ProblemStatusMismatchError",
        problemCode: "USER_NOT_FOUND",
        problemStatus: 404,
        status: 500,
      },
      response,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "external") {
      expect(result.error).toBeInstanceOf(ProblemStatusMismatchError);
      expect(result.error).toBeInstanceOf(Problem);
    }
  });

  it("keeps HTTP and Problem status mismatches external for generic Problem results", async () => {
    const response = jsonResponse(userNotFoundProblem, 500);
    const result = await readJsonProblemResult(response);

    expect(result).toMatchObject({
      ok: false,
      kind: "external",
      body: userNotFoundProblem,
      error: {
        httpStatus: 500,
        name: "ProblemStatusMismatchError",
        problemCode: "USER_NOT_FOUND",
        problemStatus: 404,
      },
      response,
    });
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

  it("normalizes malformed successful JSON into typed response failures", async () => {
    const requiredThrowingResponse = textResponse("{not-json", 200);
    const requiredError = await captureRejectedValue(handleJsonResponse(requiredThrowingResponse));

    expect(requiredError).toBeInstanceOf(ProblemResponseError);
    expect(requiredError).toMatchObject({ response: requiredThrowingResponse });
    expect((requiredError as { readonly cause?: unknown }).cause).toBeInstanceOf(SyntaxError);

    const requiredResultResponse = textResponse("{not-json", 200);
    const requiredResult = await handleJsonResult(requiredResultResponse);
    expect(requiredResult).toMatchObject({
      ok: false,
      kind: "external",
      response: requiredResultResponse,
      error: expect.any(ProblemResponseError),
    });
    if (requiredResult.ok || requiredResult.kind !== "external") {
      expect.fail("Expected an external failure result.");
    }
    expect((requiredResult.error as { readonly cause?: unknown }).cause).toBeInstanceOf(
      SyntaxError,
    );

    const optionalThrowingResponse = textResponse("{not-json", 200);
    const optionalError = await captureRejectedValue(
      readOptionalJsonResponse(optionalThrowingResponse),
    );
    expect(optionalError).toBeInstanceOf(ProblemResponseError);
    expect((optionalError as { readonly cause?: unknown }).cause).toBeInstanceOf(SyntaxError);

    const optionalResultResponse = textResponse("{not-json", 200);
    const optionalResult = await readOptionalJsonResult(optionalResultResponse);
    expect(optionalResult).toMatchObject({
      ok: false,
      kind: "external",
      response: optionalResultResponse,
      body: "{not-json",
      error: expect.any(ProblemResponseError),
    });
    if (optionalResult.ok || optionalResult.kind !== "external") {
      expect.fail("Expected an external failure result.");
    }
    expect((optionalResult.error as { readonly cause?: unknown }).cause).toBeInstanceOf(
      SyntaxError,
    );

    const genericRequiredResponse = textResponse("{not-json", 200);
    const genericRequiredResult = await readJsonProblemResult(genericRequiredResponse);
    expect(genericRequiredResult).toMatchObject({
      ok: false,
      kind: "external",
      response: genericRequiredResponse,
      error: expect.any(ProblemResponseError),
    });

    const genericOptionalResponse = textResponse("{not-json", 200);
    const genericOptionalResult = await readOptionalJsonProblemResult(genericOptionalResponse);
    expect(genericOptionalResult).toMatchObject({
      ok: false,
      kind: "external",
      response: genericOptionalResponse,
      body: "{not-json",
      error: expect.any(ProblemResponseError),
    });
  });

  it("preserves response body cancellation identity for throwing and Result helpers", async () => {
    const requiredThrowingAbort = createAbortError();
    await expect(handleJsonResponse(unreadableJsonResponse(requiredThrowingAbort))).rejects.toBe(
      requiredThrowingAbort,
    );

    const requiredResultAbort = createAbortError();
    await expect(handleJsonResult(unreadableJsonResponse(requiredResultAbort))).rejects.toBe(
      requiredResultAbort,
    );

    const optionalThrowingAbort = createAbortError();
    await expect(
      readOptionalJsonResponse(unreadableTextResponse(optionalThrowingAbort)),
    ).rejects.toBe(optionalThrowingAbort);

    const optionalResultAbort = createAbortError();
    await expect(readOptionalJsonResult(unreadableTextResponse(optionalResultAbort))).rejects.toBe(
      optionalResultAbort,
    );
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

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
    status,
  });
}

function unreadableTextResponse(cause: unknown): Response {
  const response = new Response("unreadable", { status: 200 });
  Object.defineProperty(response, "text", {
    configurable: true,
    value: async () => Promise.reject(cause),
  });

  return response;
}

function unreadableJsonResponse(cause: unknown): Response {
  const response = new Response("unreadable", { status: 200 });
  Object.defineProperty(response, "json", {
    configurable: true,
    value: async () => Promise.reject(cause),
  });

  return response;
}

function createAbortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";

  return error;
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
