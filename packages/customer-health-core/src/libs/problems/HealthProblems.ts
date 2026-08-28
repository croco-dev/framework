import { Problem, ProblemCategory } from "@croco/problems-core";

/** A score, weight, or threshold is outside the supported health-score domain. */
export class InvalidHealthScoreInputProblem extends Problem {
  readonly code = "customer-health-core/invalid-score-input";
  readonly category = ProblemCategory.ValidationError;
  readonly receivedValue: string;

  constructor(
    readonly input: string,
    value: number,
    readonly expected: string,
  ) {
    const receivedValue = String(value);
    super(
      undefined,
      undefined,
      `Invalid health score input '${input}': expected ${expected}; received ${receivedValue}`,
    );
    this.receivedValue = receivedValue;
  }
}

export class HealthScoreNotFoundProblem extends Problem {
  readonly code = "HEALTH_SCORE_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;
  constructor(tenantId: string) {
    super(undefined, undefined, `Health score not found for tenant '${tenantId}'`);
  }
}

export class HealthEventIntentConflictProblem extends Problem {
  readonly code = "customer-health-core/event-intent-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(eventId: string) {
    super(`Health event intent '${eventId}' conflicts with an existing intent`);
  }
}

export class HealthEventPublisherNotConfiguredProblem extends Problem {
  readonly code = "customer-health-core/event-publisher-not-configured";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super("Customer health event publisher is not configured");
  }
}
