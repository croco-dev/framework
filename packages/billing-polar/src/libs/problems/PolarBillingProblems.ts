import { Problem, ProblemCategory } from "@croco/problems-core";
import type { PolarConfig } from "../../types";

export type PolarConfigKey = "accessToken" | "environment" | "organizationId" | "webhookSecret";

export type PolarBillingErrorContext = {
  readonly operation: string;
  readonly provider: "polar";
  readonly status?: number;
  readonly upstreamCode?: string;
  readonly retryable?: boolean;
};

type PolarErrorRecord = Record<string, unknown>;

export class PolarMissingConfigProblem extends Problem {
  constructor(configKey: PolarConfigKey, operation = "configuration") {
    super(
      "billing-polar/missing-config",
      ProblemCategory.InternalServerError,
      `Polar billing configuration is missing required value '${configKey}'`,
      {
        extensions: {
          provider: "polar",
          operation,
          configKey,
        },
      },
    );
  }
}

export class PolarValidationProblem extends Problem {
  constructor(
    context: PolarBillingErrorContext,
    detail = "Polar billing request validation failed",
  ) {
    super(
      "billing-polar/validation-failed",
      ProblemCategory.ValidationError,
      `${detail} during ${context.operation}`,
      {
        extensions: context,
      },
    );
  }
}

/**
 * Reports that one Polar checkout operation key was reused with different checkout input.
 */
export class PolarCheckoutIdempotencyConflictProblem extends Problem {
  constructor(operation: string, operationKey: string) {
    super(
      "billing-polar/checkout-idempotency-conflict",
      ProblemCategory.Conflict,
      `Polar checkout idempotency key was reused for different checkout input during ${operation}`,
      {
        extensions: {
          provider: "polar",
          operation,
          operationKey,
          fingerprintMismatch: true,
        },
      },
    );
  }
}

export class PolarCustomerNotFoundProblem extends Problem {
  constructor(context: PolarBillingErrorContext) {
    super(
      "billing-polar/customer-not-found",
      ProblemCategory.NotFound,
      `Polar customer was not found during ${context.operation}`,
      {
        extensions: context,
      },
    );
  }
}

export class PolarSubscriptionNotFoundProblem extends Problem {
  constructor(context: PolarBillingErrorContext) {
    super(
      "billing-polar/subscription-not-found",
      ProblemCategory.NotFound,
      `Polar subscription was not found during ${context.operation}`,
      {
        extensions: context,
      },
    );
  }
}

export class PolarRetryableUpstreamProblem extends Problem {
  constructor(context: PolarBillingErrorContext) {
    super(
      "billing-polar/retryable-upstream",
      ProblemCategory.InternalServerError,
      `Polar upstream request failed retryably during ${context.operation}`,
      {
        extensions: {
          ...context,
          retryable: true,
        },
      },
    );
  }
}

export class PolarTerminalUpstreamProblem extends Problem {
  constructor(context: PolarBillingErrorContext) {
    super(
      "billing-polar/terminal-upstream",
      ProblemCategory.InternalServerError,
      `Polar upstream request failed terminally during ${context.operation}`,
      {
        extensions: {
          ...context,
          retryable: false,
        },
      },
    );
  }
}

export function validatePolarConfig(config: Partial<PolarConfig>): PolarConfig {
  if (!isNonEmptyString(config.accessToken)) {
    throw new PolarMissingConfigProblem("accessToken");
  }

  if (!isNonEmptyString(config.webhookSecret)) {
    throw new PolarMissingConfigProblem("webhookSecret");
  }

  if (config.environment !== "sandbox" && config.environment !== "production") {
    if (!isNonEmptyString(config.environment)) {
      throw new PolarMissingConfigProblem("environment");
    }

    throw new PolarValidationProblem(
      {
        provider: "polar",
        operation: "configuration",
        upstreamCode: "invalid-environment",
      },
      "Polar billing configuration environment must be 'sandbox' or 'production'",
    );
  }

  return {
    accessToken: config.accessToken,
    environment: config.environment,
    organizationId: config.organizationId,
    webhookSecret: config.webhookSecret,
  };
}

export function normalizePolarBillingError(error: unknown, operation: string): Problem {
  if (error instanceof Problem) {
    return error;
  }

  const context = createPolarBillingErrorContext(error, operation);

  if (isNotFoundError(context)) {
    const normalizedOperation = operation.toLowerCase();

    if (normalizedOperation.includes("subscription")) {
      return new PolarSubscriptionNotFoundProblem(context);
    }

    if (
      normalizedOperation.includes("customer") ||
      normalizedOperation.includes("portal") ||
      normalizedOperation.startsWith("ensurecustomer")
    ) {
      return new PolarCustomerNotFoundProblem(context);
    }

    return new PolarTerminalUpstreamProblem(context);
  }

  if (isValidationError(context)) {
    return new PolarValidationProblem(context);
  }

  if (isRetryableUpstreamError(context)) {
    return new PolarRetryableUpstreamProblem(context);
  }

  return new PolarTerminalUpstreamProblem(context);
}

function createPolarBillingErrorContext(
  error: unknown,
  operation: string,
): PolarBillingErrorContext {
  const record = asRecord(error);
  const rawResponse = asRecord(record?.rawResponse);
  const status = firstNumber(record?.status, record?.statusCode, rawResponse?.status);
  const upstreamCode = firstString(record?.error, record?.code, record?.name);

  return {
    provider: "polar",
    operation,
    ...(status !== undefined && { status }),
    ...(upstreamCode !== undefined && { upstreamCode }),
  };
}

function isNotFoundError(context: PolarBillingErrorContext): boolean {
  return context.status === 404 || context.upstreamCode === "ResourceNotFound";
}

function isValidationError(context: PolarBillingErrorContext): boolean {
  return (
    context.status === 400 ||
    context.status === 422 ||
    context.upstreamCode === "InvalidRequestError" ||
    context.upstreamCode === "SDKValidationError" ||
    context.upstreamCode === "HTTPValidationError"
  );
}

function isRetryableUpstreamError(context: PolarBillingErrorContext): boolean {
  return (
    context.status === 408 ||
    context.status === 429 ||
    (context.status !== undefined && context.status >= 500) ||
    context.upstreamCode === "ConnectionError" ||
    context.upstreamCode === "RequestTimeoutError" ||
    context.upstreamCode === "RequestAbortedError"
  );
}

function asRecord(value: unknown): PolarErrorRecord | undefined {
  if (typeof value === "object" && value !== null) {
    return value as PolarErrorRecord;
  }

  return undefined;
}

function firstNumber(...values: readonly unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function firstString(...values: readonly unknown[]): string | undefined {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value;
    }
  }

  return undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
