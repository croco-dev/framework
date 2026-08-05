import { Problem, ProblemCategory } from "@croco/problems-core";

const MAX_NATIVE_TIMER_DELAY_MS = 2_147_483_647;

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

export class RateLimitPruneIntervalProblem extends Problem {
  constructor(value: number) {
    super(
      "ratelimit/prune-interval",
      ProblemCategory.ValidationError,
      `Rate limit prune interval must be a finite delay no greater than ${MAX_NATIVE_TIMER_DELAY_MS}ms; received '${String(value)}'.`,
      {
        extensions: {
          maxDelayMs: MAX_NATIVE_TIMER_DELAY_MS,
          value: String(value),
        },
      },
    );
  }
}

export class RateLimitRefundUnsupportedProblem extends Problem {
  constructor() {
    super(
      "RATE_LIMIT_REFUND_UNSUPPORTED",
      ProblemCategory.InternalServerError,
      "Rate limit store does not support refunding a consumed request.",
    );
  }
}
