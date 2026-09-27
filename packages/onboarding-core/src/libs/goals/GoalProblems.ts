import { Problem, ProblemCategory } from "@croco/problems-core";

export class GoalDefinitionInvalidProblem extends Problem {
  readonly code = "onboarding/goal-definition-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(field: string, reason: string) {
    super(undefined, undefined, `Invalid goal definition field '${field}': ${reason}`, {
      extensions: { field, reason },
    });
  }
}

export class GoalContextInvalidProblem extends Problem {
  readonly code = "onboarding/goal-context-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(field: string) {
    super(undefined, undefined, `Goal context requires a valid '${field}'`, {
      extensions: { field },
    });
  }
}

export class GoalReceiptInvalidProblem extends Problem {
  readonly code = "onboarding/goal-receipt-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(reason: string) {
    super(undefined, undefined, `Invalid server-confirmed goal receipt: ${reason}`, {
      extensions: { reason },
    });
  }
}

export class GoalEpisodeNotFoundProblem extends Problem {
  readonly code = "onboarding/goal-episode-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor() {
    super(undefined, undefined, "Goal episode was not found");
  }
}

export class GoalDefinitionNotFoundProblem extends Problem {
  readonly code = "onboarding/goal-definition-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(definitionId: string) {
    super(undefined, undefined, `Published goal definition '${definitionId}' was not found`);
  }
}

export class GoalConflictProblem extends Problem {
  readonly code = "onboarding/goal-conflict";
  readonly category = ProblemCategory.Conflict;

  constructor(reason: string) {
    super(undefined, undefined, `Goal operation conflicts with existing state: ${reason}`, {
      extensions: { reason },
    });
  }
}

export class GoalAuthorizationProblem extends Problem {
  readonly code = "onboarding/goal-authorization-denied";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "Goal operation requires server authorization");
  }
}
