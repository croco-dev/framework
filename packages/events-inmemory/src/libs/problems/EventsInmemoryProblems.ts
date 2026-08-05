import { Problem, ProblemCategory } from "@croco/problems-core";

/** Largest concurrency value that preserves exact integer scheduling semantics. */
export const MAX_EVENT_BUS_CONCURRENCY = Number.MAX_SAFE_INTEGER;
/** Largest backpressure timeout that Node.js timers accept without clamping. */
export const MAX_EVENT_BUS_TIMEOUT_MS = 2_147_483_647;

export type EventBusNumericOption = "maxConcurrency" | "backpressureTimeoutMs";

/** Event bus numeric configuration cannot be represented with unambiguous runtime semantics. */
export class InvalidEventBusConfigurationProblem extends Problem {
  readonly code = "events-inmemory/invalid-configuration";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    readonly option: EventBusNumericOption,
    readonly value: number,
  ) {
    const constraint =
      option === "maxConcurrency"
        ? `an integer between 1 and ${MAX_EVENT_BUS_CONCURRENCY}`
        : `an integer between 1 and ${MAX_EVENT_BUS_TIMEOUT_MS} milliseconds`;
    super(
      undefined,
      undefined,
      `Invalid EventBus configuration: ${option} must be ${constraint}; received ${value}`,
    );
  }
}

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
