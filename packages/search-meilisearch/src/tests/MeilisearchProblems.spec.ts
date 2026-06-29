import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  isRetryableMeilisearchError,
  MeilisearchIndexNotFoundProblem,
  MeilisearchInvalidRequestProblem,
  MeilisearchRetryableUpstreamProblem,
  MeilisearchTerminalUpstreamProblem,
  MissingMeilisearchConfigProblem,
  normalizeMeilisearchError,
  TenantTokenNotConfiguredProblem,
} from "../libs/problems/MeilisearchProblems";

const SECRET_SAMPLE = "super-secret-token";

describe("MeilisearchProblems", () => {
  it("TenantTokenNotConfiguredProblem has correct code and category", () => {
    const problem = new TenantTokenNotConfiguredProblem();

    expect(problem.code).toBe("search-meilisearch/tenant-token-not-configured");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Tenant token options are not configured");
    expect(problem.extensions).toMatchObject({
      operation: "generateTenantToken",
      retryable: false,
    });
  });

  it("MissingMeilisearchConfigProblem identifies the missing key", () => {
    const problem = new MissingMeilisearchConfigProblem("apiKey");

    expect(problem.code).toBe("search-meilisearch/missing-config");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.extensions).toMatchObject({
      configKey: "apiKey",
      retryable: false,
    });
  });

  it("MeilisearchInvalidRequestProblem is a validation Problem", () => {
    const problem = new MeilisearchInvalidRequestProblem({ operation: "search" }, "Invalid filter");

    expect(problem.code).toBe("search-meilisearch/invalid-request");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.extensions).toMatchObject({
      operation: "search",
      retryable: false,
    });
  });

  it("MeilisearchIndexNotFoundProblem is not retryable", () => {
    const problem = new MeilisearchIndexNotFoundProblem({
      indexName: "products",
      operation: "search",
    });

    expect(problem.code).toBe("search-meilisearch/index-not-found");
    expect(problem.category).toBe(ProblemCategory.NotFound);
    expect(problem.extensions).toMatchObject({
      indexName: "products",
      retryable: false,
    });
  });

  it("normalizes retryable and terminal upstream failures", () => {
    const retryable = normalizeMeilisearchError(
      Object.assign(new Error(`token=${SECRET_SAMPLE}`), {
        response: { status: 503 },
      }),
      { operation: "search" },
    );
    const terminal = normalizeMeilisearchError(
      Object.assign(new Error("bad credentials"), {
        response: { status: 401 },
      }),
      { operation: "search" },
    );

    expect(retryable).toBeInstanceOf(MeilisearchRetryableUpstreamProblem);
    expect(retryable.detail).not.toContain(SECRET_SAMPLE);
    expect(retryable.extensions).toMatchObject({
      retryable: true,
      status: 503,
    });
    expect(terminal).toBeInstanceOf(MeilisearchTerminalUpstreamProblem);
    expect(terminal.extensions).toMatchObject({
      retryable: false,
      status: 401,
    });
  });

  it("detects retryable Meilisearch request and timeout errors", () => {
    expect(
      isRetryableMeilisearchError(
        Object.assign(new Error("unexpected failure"), {
          name: "MeiliSearchTimeOutError",
        }),
      ),
    ).toBe(true);
    expect(
      isRetryableMeilisearchError(
        Object.assign(new Error("unexpected failure"), {
          name: "MeiliSearchRequestError",
        }),
      ),
    ).toBe(true);
  });
});
