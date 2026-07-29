import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  InboxClaimConflictProblem,
  OutboxIdempotencyConflictProblem,
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

  it("should expose inbox claim conflict evidence", () => {
    const problem = new InboxClaimConflictProblem(
      "ledger-projection",
      "credit-acct-1",
      1,
      2,
      "processed",
    );

    expect(problem.code).toBe("events-tx/inbox-claim-conflict");
    expect(problem.category).toBe(ProblemCategory.Conflict);
    expect(problem.detail).toContain("expected processing attempt 1");
    expect(problem.extensions).toEqual({
      consumerId: "ledger-projection",
      inboxKey: "credit-acct-1",
      expectedAttempts: 1,
      actualAttempts: 2,
      actualStatus: "processed",
    });
  });

  it("should expose outbox idempotency conflict evidence without request values", () => {
    const problem = new OutboxIdempotencyConflictProblem("orders:create:order-1", [
      "eventType",
      "payload",
    ]);

    expect(problem.code).toBe("events-tx/outbox-idempotency-conflict");
    expect(problem.category).toBe(ProblemCategory.Conflict);
    expect(problem.extensions).toEqual({
      idempotencyKey: "orders:create:order-1",
      conflictingFields: ["eventType", "payload"],
    });
    expect(problem.toJSON()).not.toHaveProperty("payload");
  });
});
