import { Problem, ProblemCategory } from '@croco/problems-core';

export class OnboardingDefinitionNotFoundProblem extends Problem {
  readonly code = 'onboarding/definition-not-found';
  readonly category = ProblemCategory.NotFound;
  constructor(onboardingId: string) {
    super(`Onboarding definition '${onboardingId}' was not found`);
  }
}

export class OnboardingStepNotFoundProblem extends Problem {
  readonly code = 'onboarding/step-not-found';
  readonly category = ProblemCategory.NotFound;
  constructor(onboardingId: string, stepId: string) {
    super(`Step '${stepId}' was not found in onboarding '${onboardingId}'`);
  }
}

export class OnboardingContextRequiredProblem extends Problem {
  readonly code = 'onboarding/context-required';
  readonly category = ProblemCategory.Unauthorized;
  constructor() {
    super('Onboarding requires authenticated user context (tenantId & userId)');
  }
}
