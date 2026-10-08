import { Problem, ProblemCategory } from "@croco/problems-core";

export class InvalidRewardPolicyProblem extends Problem {
  readonly code = "gamification-core/invalid-policy";
  readonly category = ProblemCategory.ValidationError;
  constructor(reason: string) {
    super(undefined, undefined, reason);
  }
}
export class RewardAccessDeniedProblem extends Problem {
  readonly code = "gamification-core/access-denied";
  readonly category = ProblemCategory.Forbidden;
  constructor() {
    super(undefined, undefined, "Reward scope, subject, or actor is not authorized.");
  }
}
export class RewardEvidenceInvalidProblem extends Problem {
  readonly code = "gamification-core/invalid-evidence";
  readonly category = ProblemCategory.ValidationError;
  constructor() {
    super(undefined, undefined, "Server evidence does not belong to this subject and scope.");
  }
}
export class RewardConflictProblem extends Problem {
  readonly code = "gamification-core/conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(reason: string) {
    super(undefined, undefined, reason);
  }
}
export class RewardUnavailableProblem extends Problem {
  readonly code = "gamification-core/unavailable";
  readonly category = ProblemCategory.BusinessRuleViolation;
  constructor(reason: string) {
    super(undefined, undefined, reason);
  }
}
