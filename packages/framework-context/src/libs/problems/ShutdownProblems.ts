import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * graceful shutdown이 제한 시간을 넘겼을 때 발생하는 Problem입니다.
 */
export class ShutdownTimeoutProblem extends Problem {
  readonly code = "framework-context/shutdown-timeout";
  readonly category = ProblemCategory.InternalServerError;
  constructor(timeoutMs: number) {
    super(undefined, undefined, `Shutdown timeout exceeded after ${timeoutMs}ms`);
  }
}

/**
 * shutdown manager singleton에 서로 다른 명시적 설정이 적용될 때 발생하는 Problem입니다.
 */
export class ShutdownConfigurationConflictProblem extends Problem {
  readonly code = "framework-context/shutdown-configuration-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(currentTimeoutMs: number, requestedTimeoutMs: number) {
    super(
      undefined,
      undefined,
      `ShutdownManager is already configured with timeout ${currentTimeoutMs}ms; received conflicting timeout ${requestedTimeoutMs}ms`,
    );
  }
}
