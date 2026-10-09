import { Problem, ProblemCategory } from "@croco/problems-core";
import type { CancellationSnapshot } from "../Cancellation";

export class CancellationInputProblem extends Problem {
  readonly code = "billing/cancellation-invalid-input";
  readonly category = ProblemCategory.BadRequest;
  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}
export class CancellationAuthorizationProblem extends Problem {
  readonly code = "billing/cancellation-ownership-denied";
  readonly category = ProblemCategory.Forbidden;
  constructor() {
    super(undefined, undefined, "Cancellation resource ownership was not verified");
  }
}
export class CancellationConflictProblem extends Problem {
  readonly code = "billing/cancellation-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(readonly snapshot?: CancellationSnapshot) {
    super(undefined, undefined, "Cancellation session, subscription, quote, or decision changed", {
      extensions: snapshot ? { snapshot } : {},
    });
  }
}
export class CancellationUnavailableProblem extends Problem {
  readonly code = "billing/cancellation-action-unavailable";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor() {
    super(undefined, undefined, "Cancellation action is unavailable");
  }
}
