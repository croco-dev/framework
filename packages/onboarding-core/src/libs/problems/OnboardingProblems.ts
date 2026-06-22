import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 요청한 온보딩 정의를 찾을 수 없을 때 발생하는 Problem입니다.
 */
export class OnboardingDefinitionNotFoundProblem extends Problem {
  readonly code = "onboarding/definition-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(onboardingId: string) {
    super(undefined, undefined, `Onboarding definition '${onboardingId}' was not found`);
  }
}

/**
 * 요청한 온보딩 단계가 해당 정의에 없을 때 발생하는 Problem입니다.
 */
export class OnboardingStepNotFoundProblem extends Problem {
  readonly code = "onboarding/step-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(onboardingId: string, stepId: string) {
    super(undefined, undefined, `Step '${stepId}' was not found in onboarding '${onboardingId}'`);
  }
}

/**
 * 필수 온보딩 실행 컨텍스트가 없을 때 발생하는 Problem입니다.
 */
export class OnboardingContextRequiredProblem extends Problem {
  readonly code = "onboarding/context-required";
  readonly category = ProblemCategory.Unauthorized;
  constructor() {
    super(
      undefined,
      undefined,
      "Onboarding requires authenticated user context (tenantId & userId)",
    );
  }
}
