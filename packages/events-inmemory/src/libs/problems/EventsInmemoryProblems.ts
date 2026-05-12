import { Problem, ProblemCategory } from "@croco/problems-core";

/**
 * 인메모리 이벤트 버스의 동시 처리 한도를 초과했을 때 발생하는 Problem입니다.
 */
export class BackpressureExceededProblem extends Problem {
  readonly code = "events-inmemory/backpressure-exceeded";
  readonly category = ProblemCategory.TooManyRequests;

  constructor(currentRunning: number) {
    super(
      undefined,
      undefined,
      `Backpressure exceeded: ${currentRunning} handlers already running`,
    );
  }
}

/**
 * 인메모리 이벤트 버스의 슬롯 대기가 timeout 또는 abort로 종료되었을 때 발생하는 Problem입니다.
 */
export class BackpressureTimeoutProblem extends Problem {
  readonly code = "events-inmemory/backpressure-timeout";
  readonly category = ProblemCategory.TooManyRequests;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }

  static timeout(timeoutMs: number): BackpressureTimeoutProblem {
    return new BackpressureTimeoutProblem(`Backpressure wait timed out after ${timeoutMs}ms`);
  }

  static aborted(): BackpressureTimeoutProblem {
    return new BackpressureTimeoutProblem("Backpressure wait aborted");
  }
}
