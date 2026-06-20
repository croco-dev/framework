import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  OutboxPublishExhaustedProblem,
  OutboxStorageProblem,
  OutboxTransactionRequiredProblem,
  TransactionStateProblem,
} from "../libs/problems/EventsTxProblems";

describe("EventsTxProblems", () => {
  it("should create TransactionStateProblem with expected metadata", () => {
    const problem = new TransactionStateProblem("Transaction 'tx-1' not found");

    expect(problem.code).toBe("events-tx/transaction-state-error");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Transaction 'tx-1' not found");
  });

  it("should expose stable outbox diagnostic problem codes", () => {
    const required = new OutboxTransactionRequiredProblem();
    const storage = new OutboxStorageProblem("storage unavailable");
    const exhausted = new OutboxPublishExhaustedProblem("message-1", 3);

    expect(required.code).toBe("events-tx/outbox-transaction-required");
    expect(required.category).toBe(ProblemCategory.InternalServerError);
    expect(storage.code).toBe("events-tx/storage-error");
    expect(storage.detail).toBe("storage unavailable");
    expect(exhausted.code).toBe("events-tx/outbox-publish-exhausted");
    expect(exhausted.detail).toContain("message-1");
  });
});
