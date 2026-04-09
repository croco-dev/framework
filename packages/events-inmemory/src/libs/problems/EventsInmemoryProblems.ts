import { Problem, ProblemCategory } from '@croco/problems-core';

/**
 * 인메모리 이벤트 버스의 동시 처리 한도를 초과했을 때 발생하는 Problem입니다.
 */
export class BackpressureExceededProblem extends Problem {
  readonly code = 'events-inmemory/backpressure-exceeded';
  readonly category = ProblemCategory.TooManyRequests;

  constructor(currentRunning: number) {
    super(undefined, undefined, `Backpressure exceeded: ${currentRunning} handlers already running`);
  }
}
