import { Problem, ProblemCategory } from "@croco/problems-core";

/** Metering usage or limit data cannot produce a valid health signal. */
export class InvalidMeteringInputProblem extends Problem {
  readonly code = "customer-health-drizzle/invalid-metering-input";
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
      `Invalid metering input '${input}': expected ${expected}; received ${receivedValue}`,
    );
    this.receivedValue = receivedValue;
  }
}

/** Indicates that a persisted health-score transition did not return its required sequence. */
export class HealthTransitionSequenceMissingProblem extends Problem {
  readonly code = "customer-health-drizzle/transition-sequence-missing";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super("Health score insert did not return a transition sequence");
  }
}
