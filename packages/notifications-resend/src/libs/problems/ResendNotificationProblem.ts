import { Problem, ProblemCategory } from "@croco/problems-core";

export type ResendProblemOperation = "configuration" | "readiness" | "send";

export type ResendConfigKey = "apiKey" | "from";

export type ResendErrorContext = {
  readonly operation: ResendProblemOperation;
  readonly provider: "resend";
  readonly retryable?: boolean;
  readonly status?: number;
  readonly upstreamCode?: string;
};

export class ResendMissingConfigProblem extends Problem {
  constructor(configKey: ResendConfigKey | readonly ResendConfigKey[]) {
    const missingConfig = Array.isArray(configKey) ? configKey : [configKey];

    super(
      "notifications-resend/missing-config",
      ProblemCategory.InternalServerError,
      `Resend notification configuration is missing required value '${missingConfig.join(", ")}'`,
      {
        extensions: {
          provider: "resend",
          operation: "configuration",
          missingConfig,
          retryable: false,
        },
      },
    );
  }
}

export class ResendValidationProblem extends Problem {
  constructor(
    context: ResendErrorContext,
    detail = "Resend notification request validation failed",
  ) {
    super("notifications-resend/validation-failed", ProblemCategory.ValidationError, detail, {
      extensions: {
        ...toResendExtensions(context),
        retryable: false,
      },
    });
  }
}

export class ResendIdempotencyConflictProblem extends Problem {
  constructor(
    context: ResendErrorContext,
    detail = "Resend rejected the idempotency key for this send",
  ) {
    super("notifications-resend/idempotency-conflict", ProblemCategory.Conflict, detail, {
      extensions: {
        ...toResendExtensions(context),
        retryable: false,
      },
    });
  }
}

export class ResendRetryableUpstreamProblem extends Problem {
  constructor(context: ResendErrorContext, detail = "Resend upstream request failed retryably") {
    super("notifications-resend/retryable-upstream", ProblemCategory.InternalServerError, detail, {
      extensions: {
        ...toResendExtensions(context),
        retryable: true,
      },
    });
  }
}

export class ResendTerminalUpstreamProblem extends Problem {
  constructor(context: ResendErrorContext, detail = "Resend upstream request failed terminally") {
    super("notifications-resend/terminal-upstream", ProblemCategory.InternalServerError, detail, {
      extensions: {
        ...toResendExtensions(context),
        retryable: false,
      },
    });
  }
}

function toResendExtensions(context: ResendErrorContext): Record<string, unknown> {
  return {
    provider: context.provider,
    operation: context.operation,
    ...(context.retryable !== undefined && { retryable: context.retryable }),
    ...(context.status !== undefined && { upstreamStatus: context.status }),
    ...(context.upstreamCode !== undefined && { upstreamCode: context.upstreamCode }),
  };
}

export class ResendNotificationProblem extends Problem {
  constructor(detail: string, cause?: Error) {
    super("RESEND_NOTIFICATION_FAILED", ProblemCategory.InternalServerError, detail, {
      cause,
      extensions: {
        provider: "resend",
        retryable: false,
      },
    });
  }
}
