import { Problem, ProblemCategory } from "@croco/problems-core";

export type RetryNumericConstraint =
  | "finite-positive-number"
  | "non-negative-timer-integer"
  | "positive-safe-integer"
  | "positive-timer-integer";

/**
 * 서킷 상태 저장소 조회나 갱신 중 문제가 발생했을 때 사용하는 Problem입니다.
 */
export class CircuitBreakerStateProblem extends Problem {
  readonly code = "RETRY_CIRCUIT_BREAKER_INVALID_STATE";
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}

/**
 * 분산 서킷 락 획득이나 해제 중 문제가 발생했을 때 사용하는 Problem입니다.
 */
export class CircuitBreakerLockProblem extends Problem {
  readonly code = "RETRY_CIRCUIT_BREAKER_LOCK_FAILED";
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}

/**
 * Lambda 남은 실행 시간이 부족해 재시도를 중단할 때 발생하는 Problem입니다.
 */
export class LambdaTimeoutProblem extends Problem {
  readonly code = "LAMBDA_TIMEOUT_GUARD";
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super("LAMBDA_TIMEOUT_GUARD", ProblemCategory.InternalServerError, detail);
  }
}

/**
 * 재시도 관련 설정값이 유효하지 않을 때 발생하는 구성 오류입니다.
 */
export class InvalidRetryConfigurationProblem extends Problem {
  readonly code = "INVALID_RETRY_CONFIGURATION";
  readonly category = ProblemCategory.ValidationError;

  constructor(option: string, constraint: RetryNumericConstraint, received: number) {
    super(
      "INVALID_RETRY_CONFIGURATION",
      ProblemCategory.ValidationError,
      `Retry option '${option}' must satisfy '${constraint}'`,
      {
        extensions: {
          option,
          constraint,
          received: String(received),
        },
      },
    );
  }
}

/**
 * 업무 콜백이 성공한 뒤 onSuccess 훅이 실패했을 때 발생하는 Problem입니다.
 */
export class RetrySuccessHookProblem extends Problem {
  readonly code = "retry-core/success-hook-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(methodName: string, attempt: number, cause: unknown) {
    const causeError = cause instanceof Error ? cause : new Error(String(cause));
    super(
      undefined,
      undefined,
      `Retry callback '${methodName}' succeeded, but its onSuccess hook failed`,
      {
        cause: causeError,
        extensions: {
          attempt,
          callbackSucceeded: true,
          hook: "onSuccess",
          methodName,
        },
      },
    );
  }
}
