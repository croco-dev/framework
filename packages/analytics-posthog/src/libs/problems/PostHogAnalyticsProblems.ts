import { Problem, ProblemCategory } from "@croco/problems-core";

export class PostHogAnalyticsCaptureProblem extends Problem {
  readonly code = "analytics-posthog/capture-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(eventName: string, cause?: Error) {
    super(undefined, undefined, `PostHog analytics capture failed for ${eventName}`, {
      cause,
      extensions: {
        provider: "posthog",
        eventName,
      },
    });
  }
}

export class PostHogAnalyticsFlushProblem extends Problem {
  readonly code = "analytics-posthog/flush-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(cause?: Error) {
    super(undefined, undefined, "PostHog analytics flush failed", {
      cause,
      extensions: {
        provider: "posthog",
      },
    });
  }
}

export class PostHogAnalyticsReadinessProblem extends Problem {
  readonly code = "analytics-posthog/readiness-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    options: {
      readonly cause?: Error;
      readonly upstreamCode?: string;
      readonly upstreamStatus?: number;
    } = {},
  ) {
    super(undefined, undefined, "PostHog analytics readiness check failed", {
      cause: options.cause,
      extensions: {
        provider: "posthog",
        ...(options.upstreamCode && { upstreamCode: options.upstreamCode }),
        ...(options.upstreamStatus !== undefined && { upstreamStatus: options.upstreamStatus }),
      },
    });
  }
}
