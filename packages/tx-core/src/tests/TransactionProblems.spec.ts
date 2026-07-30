import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  DuplicateTxManagerRegistrationProblem,
  TxManagerNotRegisteredError,
  TxPropagationError,
} from "../libs/errors";
import {
  AfterCommitOutcomeRequiredProblem,
  AfterCommitRegistrationClosedProblem,
  AfterCommitHooksProblem,
  DetachedTransactionOperationProblem,
  InvalidTransactionTimeoutProblem,
  TransactionContextProblem,
  TransactionDecoratorProblem,
  TransactionOutcomeContextProblem,
  TransactionOutcomeUnknownProblem,
  TransactionRollbackConfirmedProblem,
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

  it("should create TransactionOutcomeContextProblem with expected metadata", () => {
    const problem = new TransactionOutcomeContextProblem();

    expect(problem.code).toBe("tx-core/outcome-requires-root");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("runWithOutcome must start outside an active transaction");
  });

  it("should create AfterCommitOutcomeRequiredProblem with expected metadata", () => {
    const problem = new AfterCommitOutcomeRequiredProblem();

    expect(problem.code).toBe("tx-core/after-commit-outcome-required");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe(
      "onAfterCommit requires runWithOutcome so post-commit failures cannot be discarded",
    );
  });

  it("should create AfterCommitRegistrationClosedProblem with expected metadata", () => {
    const problem = new AfterCommitRegistrationClosedProblem();

    expect(problem.code).toBe("tx-core/after-commit-registration-closed");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("onAfterCommit registration is closed for this transaction");
  });

  it("should create DetachedTransactionOperationProblem with expected metadata", () => {
    const problem = new DetachedTransactionOperationProblem(2);

    expect(problem.code).toBe("tx-core/detached-transaction-operation");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe(
      "Transaction callback completed with 2 detached nested operation(s)",
    );
  });

  it("should create InvalidTransactionTimeoutProblem with expected metadata", () => {
    const problem = new InvalidTransactionTimeoutProblem("run", Number.NaN);

    expect(problem.code).toBe("tx-core/invalid-transaction-timeout");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe(
      "Transaction run timeout must be an integer between 1 and 2147483647 milliseconds; received NaN",
    );
  });

  it("should create AfterCommitHooksProblem with expected metadata", () => {
    const cause = new Error("event publish failed");
    const problem = new AfterCommitHooksProblem(
      [
        { phase: "hook", hookIndex: 0, name: cause.name, message: cause.message },
        {
          phase: "hook",
          hookIndex: 1,
          name: "CacheError",
          message: "cache refresh failed",
          code: "CACHE_REFRESH_FAILED",
        },
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
      reportingFailureCount: 0,
      failures: [
        {
          phase: "hook",
          hookIndex: 0,
          name: "Error",
          message: "event publish failed",
        },
        {
          phase: "hook",
          hookIndex: 1,
          name: "CacheError",
          message: "cache refresh failed",
          code: "CACHE_REFRESH_FAILED",
        },
      ],
    });
  });

  it("should create TransactionOutcomeUnknownProblem with commit-aware metadata", () => {
    const cause = new Error("adapter failed after cancellation");
    const problem = new TransactionOutcomeUnknownProblem(50, cause);

    expect(problem.code).toBe("tx-core/transaction-outcome-unknown");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Transaction outcome is unknown after the 50ms deadline");
    expect(problem.cause).toBe(cause);
    expect(problem.extensions).toEqual({
      committed: "unknown",
      timedOut: true,
      timeoutMs: 50,
    });
  });

  it("should create TransactionRollbackConfirmedProblem with rollback metadata", () => {
    const cause = new Error("transaction deadline exceeded");
    const problem = new TransactionRollbackConfirmedProblem(cause);

    expect(problem.code).toBe("tx-core/transaction-rollback-confirmed");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Transaction rollback completed after cancellation");
    expect(problem.cause).toBe(cause);
    expect(problem.extensions).toEqual({
      committed: false,
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
