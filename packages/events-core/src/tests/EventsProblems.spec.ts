import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  EventAfterCommitOutcomeRequiredProblem,
  EventBusDrainIncompleteProblem,
  EventBusIntakeClosedProblem,
  EventBusNotSetProblem,
  EventDefinitionProblem,
  EventDeserializationError,
  InvalidEventBusDrainTimeoutProblem,
  UnknownEventTypeProblem,
} from "../libs/problems/EventsProblems";

describe("EventsProblems", () => {
  it("classifies publishes after shutdown as a closed-intake conflict", () => {
    const problem = new EventBusIntakeClosedProblem();

    expect(problem.code).toBe("events-core/event-bus-intake-closed");
    expect(problem.category).toBe(ProblemCategory.Conflict);
  });

  it("describes invalid drain timeout configuration", () => {
    const problem = new InvalidEventBusDrainTimeoutProblem(Number.NaN);

    expect(problem.code).toBe("events-core/event-bus-drain-timeout-invalid");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.timeoutMs).toBeNaN();
  });

  it("preserves unfinished handler evidence for an incomplete drain", () => {
    const unfinishedHandlers = [
      {
        eventName: "order.created",
        handlerName: "ProjectOrder",
        startTime: 1_000,
      },
    ];
    const problem = new EventBusDrainIncompleteProblem("timed-out", unfinishedHandlers);

    expect(problem.code).toBe("events-core/event-bus-drain-incomplete");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.drainStatus).toBe("timed-out");
    expect(problem.unfinishedHandlers).toEqual(unfinishedHandlers);
    expect(problem.unfinishedHandlers).not.toBe(unfinishedHandlers);
    expect(problem.extensions).toEqual({
      drainStatus: "timed-out",
      unfinishedHandlerCount: 1,
    });
  });

  it("should describe the missing after-commit outcome capability", () => {
    const problem = new EventAfterCommitOutcomeRequiredProblem();

    expect(problem.code).toBe("events-core/after-commit-outcome-required");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe(
      "publishAfterCommit requires a transaction that can return after-commit delivery evidence.",
    );
  });

  it("should create EventBusNotSetProblem with expected metadata", () => {
    const problem = new EventBusNotSetProblem();

    expect(problem.code).toBe("events-core/event-bus-not-set");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("EventBus has not been set. Call setEventBus() first.");
  });

  it("should create EventDefinitionProblem with expected metadata", () => {
    const problem = new EventDefinitionProblem();

    expect(problem.code).toBe("events-core/event-definition-error");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("DomainEvent subclass must define static eventName");
  });

  it("should create UnknownEventTypeProblem with expected metadata", () => {
    const problem = new UnknownEventTypeProblem("UnknownEvent");

    expect(problem.code).toBe("events-core/unknown-event-type");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Unknown event type: 'UnknownEvent'");
  });

  it("should create EventDeserializationError with expected metadata", () => {
    const error = new EventDeserializationError("OrderCreated", "missing @EventField decorator");

    expect(error.code).toBe("events-core/deserialization-error");
    expect(error.category).toBe(ProblemCategory.InternalServerError);
    expect(error.detail).toBe(
      "Cannot deserialize event 'OrderCreated': missing @EventField decorator",
    );
  });
});
