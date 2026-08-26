import { describe, expect, it } from "vitest";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  GraphQLAuthenticationProblem,
  GraphQLAuthorizationProblem,
  GraphQLInternalError,
  GraphQLNotFoundProblem,
  GraphQLValidationProblem,
  isProblem,
  problemToGraphQLError,
} from "../libs/errors";
import { GraphQLAuthGuard } from "../libs/guards/AuthGuard";
import type { TypedResolver } from "../libs/types/ResolverTypes";

class TestGraphQLProblem extends Problem {
  constructor(
    code: string,
    category: ProblemCategory,
    detail: string,
    extensions?: Record<string, unknown>,
  ) {
    super(code, category, detail, { extensions });
  }
}

describe("GraphQLProblems", () => {
  it("should create validation problem with correct category", () => {
    const problem = new GraphQLValidationProblem("VALIDATION_ERROR", "Invalid input", {
      field: "email",
    });

    expect(problem.code).toBe("VALIDATION_ERROR");
    expect(problem.status).toBe(422);
    expect(problem.title).toBe("Validation Error");
    expect(problem.extensions).toEqual({ field: "email" });
  });

  it("should reject extensions that attempt to replace core Problem fields", () => {
    expect(
      () => new GraphQLValidationProblem("VALIDATION_ERROR", "Invalid input", { status: 500 }),
    ).toThrow('extensions["status"]');
  });

  it("should create authorization problem with correct category", () => {
    const problem = new GraphQLAuthorizationProblem("ACCESS_DENIED", "Access denied");

    expect(problem.code).toBe("ACCESS_DENIED");
    expect(problem.status).toBe(403);
  });

  it("should create authentication problem with correct category", () => {
    const problem = new GraphQLAuthenticationProblem("UNAUTHORIZED", "Unauthorized");

    expect(problem.code).toBe("UNAUTHORIZED");
    expect(problem.status).toBe(401);
  });

  it("should create not found problem with detail", () => {
    const problem = new GraphQLNotFoundProblem("User", "123");

    expect(problem.code).toBe("GRAPHQL_NOT_FOUND");
    expect(problem.status).toBe(404);
    expect(problem.detail).toContain("User");
    expect(problem.detail).toContain("123");
  });

  it("should create not found problem without id", () => {
    const problem = new GraphQLNotFoundProblem("User");

    expect(problem.detail).toBe("User not found");
  });

  it("should create internal error with cause", () => {
    const cause = new Error("Original error");
    const problem = new GraphQLInternalError("INTERNAL_ERROR", "Something went wrong", cause);

    expect(problem.code).toBe("INTERNAL_ERROR");
    expect(problem.status).toBe(500);
    expect(problem.cause).toBe(cause);
  });
});

describe("ErrorConverter", () => {
  it("should convert problem to GraphQL error", () => {
    const problem = new GraphQLValidationProblem("VALIDATION_ERROR", "Invalid input");
    const error = problemToGraphQLError(problem);

    expect(error.extensions).toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
      title: "Validation Error",
    });
  });

  it("should emit a redacted GraphQL Problem extension payload", () => {
    const problem = new GraphQLValidationProblem("GRAPHQL_INPUT_INVALID", "Email is invalid", {
      field: "email",
      issues: [{ path: "email", message: "must be an email" }],
      requestId: "request-golden-graphql",
      traceId: "trace-golden-graphql",
      diagnostics: "provider-secret",
    });
    const error = problemToGraphQLError(problem, ["Mutation", "createUser"]);

    expect(error.message).toBe("Email is invalid");
    expect(error.path).toEqual(["Mutation", "createUser"]);
    expect(error.extensions).toEqual({
      code: "GRAPHQL_INPUT_INVALID",
      status: 422,
      title: "Validation Error",
      type: "about:blank",
      field: "email",
      issues: [{ path: "email", message: "must be an email" }],
    });
    expect(error.extensions).not.toHaveProperty("requestId");
    expect(error.extensions).not.toHaveProperty("traceId");
    expect(error.extensions).not.toHaveProperty("diagnostics");
    expect(error.extensions).not.toHaveProperty("redactionPolicy");
  });

  it("should not invent HTTP correlation metadata in GraphQL Problem extensions", () => {
    const problem = new GraphQLInternalError("GRAPHQL_RESOLVER_FAILED", "Resolver failed");
    const error = problemToGraphQLError(problem, ["Query", "user"]);

    expect(error.message).toBe("An internal error occurred");
    expect(error.path).toEqual(["Query", "user"]);
    expect(error.extensions).toEqual({
      code: "GRAPHQL_RESOLVER_FAILED",
      status: 500,
      title: "Internal Server Error",
      type: "about:blank",
    });
    expect(error.extensions).not.toHaveProperty("requestId");
    expect(error.extensions).not.toHaveProperty("traceId");
  });

  it("should retain safe-message detail and allowed extensions", () => {
    const problem = new TestGraphQLProblem(
      "ACCESS_DENIED",
      ProblemCategory.Forbidden,
      "You cannot access this tenant",
      {
        reason: "tenant mismatch",
        providerSecret: "secret",
      },
    );
    const error = problemToGraphQLError(problem);

    expect(error.message).toBe("You cannot access this tenant");
    expect(error.extensions).toMatchObject({
      code: "ACCESS_DENIED",
      status: 403,
      title: "Forbidden",
      reason: "tenant mismatch",
    });
    expect(error.extensions).not.toHaveProperty("providerSecret");
    expect(error.extensions).not.toHaveProperty("redactionPolicy");
  });

  it("should redact operator-only details and extensions", () => {
    const problem = new TestGraphQLProblem(
      "transports-graphql/schema-not-configured",
      ProblemCategory.InternalServerError,
      "Database password is invalid",
      {
        reason: "database password is invalid",
        field: "schema",
      },
    );
    const error = problemToGraphQLError(problem);

    expect(error.message).toBe("An internal error occurred");
    expect(error.extensions).toEqual({
      code: "transports-graphql/schema-not-configured",
      status: 500,
      title: "Internal Server Error",
      type: "about:blank",
    });
  });

  it("should use category fallback for unknown codes", () => {
    const problem = new TestGraphQLProblem(
      "example/user-not-found",
      ProblemCategory.NotFound,
      "User 123 was not found",
      {
        reason: "deleted",
        diagnostic: "store:primary",
      },
    );
    const error = problemToGraphQLError(problem);

    expect(error.message).toBe("User 123 was not found");
    expect(error.extensions).toMatchObject({
      code: "example/user-not-found",
      status: 404,
      title: "Not Found",
      reason: "deleted",
    });
    expect(error.extensions).not.toHaveProperty("diagnostic");
  });

  it("should include path in GraphQL error", () => {
    const problem = new GraphQLNotFoundProblem("User", "123");
    const path = ["users", "getById"];
    const error = problemToGraphQLError(problem, path);

    expect(error.path).toEqual(path);
  });

  it("should identify problem instances", () => {
    const problem = new GraphQLValidationProblem("TEST", "test");
    expect(isProblem(problem)).toBe(true);
  });

  it("should identify non-problem errors", () => {
    expect(isProblem(new Error())).toBe(false);
    expect(
      isProblem(
        Object.assign(new Error("provider failure"), {
          code: "ACCESS_DENIED",
          category: ProblemCategory.Forbidden,
        }),
      ),
    ).toBe(false);
    expect(isProblem(null)).toBe(false);
    expect(isProblem("string")).toBe(false);
  });
});

describe("TypedResolver", () => {
  it("should type resolver correctly", async () => {
    type User = { id: string; name: string };
    type CreateUserArgs = { name: string };
    type Context = { requestId: string };

    const resolver: TypedResolver<unknown, Context, CreateUserArgs, User> = async (
      _source,
      args,
      _context,
    ) => {
      return { id: "1", name: args.name };
    };

    const result = await resolver({}, { name: "Test" }, { requestId: "123" }, {});
    expect(result.name).toBe("Test");
  });
});
