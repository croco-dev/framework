import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  CarryingCapacitySimulationProblem,
  InvalidCarryingCapacityConfigProblem,
  InvalidRetentionMovementProblem,
  RetentionMetricsUnavailableProblem,
} from "../libs/problems/MetricsProblems";

describe("MetricsProblems", () => {
  it("CarryingCapacitySimulationProblem has correct code and category", () => {
    const problem = new CarryingCapacitySimulationProblem(
      "Simulated churn rate is zero → infinite capacity",
    );

    expect(problem.code).toBe("metrics-core/carrying-capacity-simulation-error");
    expect(problem.category).toBe(ProblemCategory.BusinessRuleViolation);
    expect(problem.detail).toBe("Simulated churn rate is zero → infinite capacity");
  });

  it("RetentionMetricsUnavailableProblem has correct code and category", () => {
    const problem = new RetentionMetricsUnavailableProblem();

    expect(problem.code).toBe("metrics-core/retention-metrics-unavailable");
    expect(problem.category).toBe(ProblemCategory.NotImplemented);
    expect(problem.detail).toBe(
      "Retention metrics are not available until full retention calculation is implemented",
    );
  });

  it("InvalidCarryingCapacityConfigProblem identifies the invalid field and value", () => {
    const problem = new InvalidCarryingCapacityConfigProblem("lookbackDays", Number.NaN);

    expect(problem.code).toBe("metrics-core/invalid-carrying-capacity-config");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe(
      "Carrying capacity configuration 'lookbackDays' must be a positive safe integer; received NaN.",
    );
    expect(problem.extensions).toMatchObject({
      field: "lookbackDays",
      receivedValue: "NaN",
      retryable: false,
    });
  });

  it("InvalidRetentionMovementProblem has correct code and category", () => {
    const problem = new InvalidRetentionMovementProblem("churned", Number.NaN);

    expect(problem.code).toBe("metrics-core/invalid-retention-movement");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe(
      "Retention movement 'churned' amount must be a finite non-negative number: NaN",
    );
  });
});
