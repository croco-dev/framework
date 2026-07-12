import { Problem, ProblemCategory } from "@croco/problems-core";

const PROBLEM_TYPE_BASE = "https://croco.dev/problems/transports-http";

export type HttpRequestBodyTooLargeProblemOptions = {
  readonly limit: number;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
};

/** The configured body boundary cannot be enforced safely. */
export class HttpBodyLimitConfigurationProblem extends Problem {
  constructor() {
    super(
      "transports-http/body-limit-invalid-configuration",
      ProblemCategory.InternalServerError,
      "bodyLimitMiddleware limit must be a finite, nonnegative safe integer",
      {
        type: `${PROBLEM_TYPE_BASE}/body-limit-invalid-configuration`,
      },
    );
  }
}

/** Actual request bytes exceeded the configured transport boundary. */
export class HttpRequestBodyTooLargeProblem extends Problem {
  readonly #status: number;

  constructor(options: HttpRequestBodyTooLargeProblemOptions) {
    super(
      "transports-http/request-body-too-large",
      ProblemCategory.PayloadTooLarge,
      options.detail,
      {
        type: `${PROBLEM_TYPE_BASE}/request-body-too-large`,
        instance: options.instance,
        extensions: { limit: options.limit },
      },
    );
    this.#status = options.status;
  }

  override get status(): number {
    return this.#status;
  }
}

/** The limiter ran after another component disturbed or locked the request body. */
export class HttpRequestBodyUnavailableProblem extends Problem {
  constructor(instance: string) {
    super(
      "transports-http/request-body-unavailable",
      ProblemCategory.InternalServerError,
      "Request body is unavailable. Place bodyLimitMiddleware before body-consuming middleware.",
      {
        type: `${PROBLEM_TYPE_BASE}/request-body-unavailable`,
        instance,
      },
    );
  }
}

/** The transport could not finish reading the request body. */
export class HttpRequestBodyReadProblem extends Problem {
  constructor(instance: string, aborted: boolean, cause: Error) {
    super(
      "transports-http/request-body-read-failed",
      ProblemCategory.BadRequest,
      aborted ? "Request body reading was aborted" : "Request body could not be read",
      {
        type: `${PROBLEM_TYPE_BASE}/request-body-read-failed`,
        instance,
        cause,
      },
    );
  }
}
