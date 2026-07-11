import { ProblemCategory } from "@croco/problems-core";
import {
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderFactoryResolutionProblem,
  BatchLoaderScopeCollisionProblem,
  type BatchLoadOptions,
  type BatchLoadScope,
  type BatchLoadScopeResolver,
} from "@croco/repository-core";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("BatchLoad Problem exports", () => {
  it("should expose BatchLoad Problem classes from the package root", () => {
    const notRegisteredProblem = new BatchLoaderFactoryNotRegisteredProblem();
    const resolutionProblem = new BatchLoaderFactoryResolutionProblem("Container lookup failed");
    const scopeCollisionProblem = new BatchLoaderScopeCollisionProblem("users-by-id");

    expect(notRegisteredProblem.code).toBe("repository-core/batch-loader-factory-not-registered");
    expect(notRegisteredProblem.category).toBe(ProblemCategory.InternalServerError);
    expect(resolutionProblem.code).toBe("repository-core/batch-loader-factory-resolution-failed");
    expect(resolutionProblem.category).toBe(ProblemCategory.InternalServerError);
    expect(scopeCollisionProblem.code).toBe("repository-core/batch-loader-scope-collision");
    expect(scopeCollisionProblem.category).toBe(ProblemCategory.InternalServerError);
  });

  it("should expose typed BatchLoad scope contracts from the package root", () => {
    type ScopedRepository = { transaction: symbol };
    const scope: BatchLoadScope = Symbol("transaction");
    const resolver: BatchLoadScopeResolver<ScopedRepository> = (repository) =>
      repository.transaction;
    const options: BatchLoadOptions<ScopedRepository> = {
      by: "id",
      scope: resolver,
    };

    expectTypeOf(scope).toMatchTypeOf<BatchLoadScope>();
    expectTypeOf(options.scope).toEqualTypeOf<
      BatchLoadScopeResolver<ScopedRepository> | undefined
    >();
  });
});
