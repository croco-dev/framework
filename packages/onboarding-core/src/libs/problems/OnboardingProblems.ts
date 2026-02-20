import { Problem, ProblemCategory } from '@croco/problems-core';

export class OnboardingDefinitionNotFoundProblem extends Problem {
  constructor(onboardingId: string) {
    super(
      'onboarding/definition-not-found',
      ProblemCategory.NotFound,
      `Onboarding definition '${onboardingId}' was not found`
    );
  }
}

export class OnboardingStepNotFoundProblem extends Problem {
  constructor(onboardingId: string, stepId: string) {
    super(
      'onboarding/step-not-found',
      ProblemCategory.NotFound,
      `Step '${stepId}' was not found in onboarding '${onboardingId}'`
    );
  }
}

export class OnboardingContextRequiredProblem extends Problem {
  constructor() {
    super(
      'onboarding/context-required',
      ProblemCategory.Unauthorized,
      'Onboarding requires authenticated user context (tenantId & userId)'
    );
  }
}
