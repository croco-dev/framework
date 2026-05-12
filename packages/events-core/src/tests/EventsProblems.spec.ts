import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  EventBusNotSetProblem,
  EventDefinitionProblem,
  EventDeserializationError,
  UnknownEventTypeProblem,
} from "../libs/problems/EventsProblems";

describe("EventsProblems", () => {
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
