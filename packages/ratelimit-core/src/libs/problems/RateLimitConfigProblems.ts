import { Problem, ProblemCategory } from "@croco/problems-core";

export class RateLimitKeyBuilderProblem extends Problem {
  readonly code = "RATE_LIMIT_KEY_BUILDER_ERROR";
  readonly category = ProblemCategory.InternalServerError;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}

export class RateLimitWindowProblem extends Problem {
  readonly code = "RATE_LIMIT_WINDOW_ERROR";
  readonly category = ProblemCategory.BadRequest;

  // biome-ignore lint/complexity/noUselessConstructor: Problem 클래스의 protected constructor 호출 필요
  constructor(detail: string) {
    super(detail);
  }
}
