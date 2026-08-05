import { ProblemCategory } from "@croco/problems-core";
import {
  BatchLoadDuplicateResultKeyProblem,
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderFactoryResolutionProblem,
  BatchLoadResultIdentityMismatchProblem,
  BatchLoaderScopeCollisionProblem,
  BatchLoadUnexpectedResultKeyProblem,
  BatchLoadUnkeyedResultProblem,
} from "@croco/repository-core";
import type {
  BatchLoadOptions,
  BatchLoadScope,
  BatchLoadScopeResolver,
  KeyedRepositoryResult,
} from "@croco/repository-core";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("BatchLoad Problem exports", () => {
  it("should expose BatchLoad Problem classes from the package root", () => {
    const notRegisteredProblem = new BatchLoaderFactoryNotRegisteredProblem();
    const resolutionProblem = new BatchLoaderFactoryResolutionProblem("Container lookup failed");
    const scopeCollisionProblem = new BatchLoaderScopeCollisionProblem("users-by-id");
    const unkeyedProblem = new BatchLoadUnkeyedResultProblem(0);
    const duplicateProblem = new BatchLoadDuplicateResultKeyProblem();
    const unexpectedProblem = new BatchLoadUnexpectedResultKeyProblem();
    const mismatchProblem = new BatchLoadResultIdentityMismatchProblem("id");

    expect(notRegisteredProblem.code).toBe("repository-core/batch-loader-factory-not-registered");
    expect(notRegisteredProblem.category).toBe(ProblemCategory.InternalServerError);
    expect(resolutionProblem.code).toBe("repository-core/batch-loader-factory-resolution-failed");
    expect(resolutionProblem.category).toBe(ProblemCategory.InternalServerError);
    expect(scopeCollisionProblem.code).toBe("repository-core/batch-loader-scope-collision");
    expect(scopeCollisionProblem.category).toBe(ProblemCategory.InternalServerError);
    expect(unkeyedProblem.code).toBe("repository-core/batch-load-result-unkeyed");
    expect(duplicateProblem.code).toBe("repository-core/batch-load-result-key-duplicate");
    expect(unexpectedProblem.code).toBe("repository-core/batch-load-result-key-unexpected");
    expect(mismatchProblem.code).toBe("repository-core/batch-load-result-identity-mismatch");
    expect([unkeyedProblem, duplicateProblem, unexpectedProblem, mismatchProblem]).toSatisfy(
      (problems: Array<{ category: ProblemCategory }>) =>
        problems.every((problem) => problem.category === ProblemCategory.InternalServerError),
    );
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

  it("should expose the keyed repository result contract from the package root", () => {
    const result: KeyedRepositoryResult<string, { id: string }> = {
      key: "user-1",
      value: { id: "user-1" },
    };

    expectTypeOf(result.key).toEqualTypeOf<string>();
    expectTypeOf(result.value).toEqualTypeOf<{ id: string }>();
  });
});
