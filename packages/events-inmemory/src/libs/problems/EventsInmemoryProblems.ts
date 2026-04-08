import { Problem, ProblemCategory } from '@croco/problems-core';

export class BackpressureExceededProblem extends Problem {
  readonly code = 'events-inmemory/backpressure-exceeded';
  readonly category = ProblemCategory.TooManyRequests;

  constructor(currentRunning: number) {
    super(undefined, undefined, `Backpressure exceeded: ${currentRunning} handlers already running`);
  }
}
