import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 동일한 ID의 온보딩 정의를 중복 등록할 때 발생하는 구성 Problem입니다.
 */
export class DuplicateOnboardingDefinitionProblem extends Problem {
  constructor(onboardingId: string) {
    super(
      "onboarding/duplicate-definition-registration",
      ProblemCategory.InternalServerError,
      `Onboarding definition '${onboardingId}' is already registered`,
      {
        extensions: {
          onboardingId,
          retryable: false,
        },
      },
    );
  }
}

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

/**
 * 온보딩 단계 상태의 동시 변경 충돌이 유한 재시도 안에 해소되지 않을 때 발생하는 Problem입니다.
 */
export class OnboardingStepCompletionConflictProblem extends Problem {
  readonly code = "onboarding/step-completion-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(onboardingId: string, stepId: string) {
    super(
      undefined,
      undefined,
      `Step '${stepId}' in onboarding '${onboardingId}' could not be completed due to concurrent updates`,
    );
  }
}
