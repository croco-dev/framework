import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  DuplicateTxManagerRegistrationProblem,
  TxManagerNotRegisteredError,
  TxPropagationError,
} from "../libs/errors";
import {
  AfterCommitHooksProblem,
  TransactionContextProblem,
  TransactionDecoratorProblem,
} from "../libs/problems/TransactionProblems";

describe("TransactionProblems", () => {
  it("should create TransactionDecoratorProblem with expected metadata", () => {
    const problem = new TransactionDecoratorProblem();

    expect(problem.code).toBe("tx-core/decorator-misuse");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("@Transactional can only be applied to methods");
  });

  it("should create TransactionContextProblem with expected metadata", () => {
    const problem = new TransactionContextProblem();

    expect(problem.code).toBe("tx-core/missing-transaction-context");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("onAfterCommit must be called within a transaction");
  });

  it("should create AfterCommitHooksProblem with expected metadata", () => {
    const cause = new Error("event publish failed");
    const problem = new AfterCommitHooksProblem(
      [
        { name: cause.name, message: cause.message },
        { name: "CacheError", message: "cache refresh failed" },
      ],
      cause,
    );

    expect(problem.code).toBe("tx-core/after-commit-hooks-failed");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("2 afterCommit hook(s) failed after transaction commit");
    expect(problem.cause).toBe(cause);
    expect(problem.extensions).toEqual({
      committed: true,
      failureCount: 2,
      failures: [
        { name: "Error", message: "event publish failed" },
        { name: "CacheError", message: "cache refresh failed" },
      ],
    });
  });

  it("should create TxManagerNotRegisteredError with expected metadata", () => {
    const error = new TxManagerNotRegisteredError("my-db");

    expect(error.code).toBe("tx-core/manager-not-registered");
    expect(error.category).toBe(ProblemCategory.InternalServerError);
    expect(error.detail).toBe("TxManager not registered for key: my-db");
  });

  it("should create DuplicateTxManagerRegistrationProblem with expected metadata", () => {
    const error = new DuplicateTxManagerRegistrationProblem("my-db");

    expect(error.code).toBe("tx-core/duplicate-tx-manager-registration");
    expect(error.category).toBe(ProblemCategory.InternalServerError);
    expect(error.detail).toBe("TxManager is already registered for key: my-db");
  });

  it("should create DuplicateTxManagerRegistrationProblem with default fallback metadata", () => {
    const error = new DuplicateTxManagerRegistrationProblem(undefined);

    expect(error.code).toBe("tx-core/duplicate-tx-manager-registration");
    expect(error.category).toBe(ProblemCategory.InternalServerError);
    expect(error.detail).toBe("TxManager is already registered for key: default");
  });

  it("should create TxPropagationError with expected metadata", () => {
    const error = new TxPropagationError("propagation failed");

    expect(error.code).toBe("tx-core/propagation-error");
    expect(error.category).toBe(ProblemCategory.BusinessRuleViolation);
    expect(error.detail).toBe("propagation failed");
  });
});
