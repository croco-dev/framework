import { Problem, ProblemCategory } from "@croco/problems-core";

export class SurveyInvalidProblem extends Problem {
  readonly code = "research/survey-invalid";
  readonly category = ProblemCategory.ValidationError;
  constructor(reason: string) {
    super(undefined, undefined, `Invalid survey input: ${reason}`, { extensions: { reason } });
  }
}
export class SurveyConflictProblem extends Problem {
  readonly code = "research/survey-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(reason: string) {
    super(undefined, undefined, `Survey operation conflicts: ${reason}`, {
      extensions: { reason },
    });
  }
}
export class SurveyDeniedProblem extends Problem {
  readonly code = "research/survey-denied";
  readonly category = ProblemCategory.Forbidden;
  constructor() {
    super(undefined, undefined, "Survey access denied");
  }
}
export class SurveyExpiredProblem extends Problem {
  readonly code = "research/survey-expired";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(undefined, undefined, "Survey invitation expired");
  }
}
export class SurveyUnavailableProblem extends Problem {
  readonly code = "research/survey-unavailable";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "Survey storage unavailable");
  }
}
