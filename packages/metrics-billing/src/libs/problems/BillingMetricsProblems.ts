import { Problem, ProblemCategory } from "@croco/problems-core";

export type BillingMetricDropReason =
  | "account_not_found"
  | "subscription_not_found"
  | "plan_not_found";

export type BillingMetricDroppedProblemOptions = {
  readonly eventName: string;
  readonly tenantId: string;
  readonly eventKey: string;
  readonly reason: BillingMetricDropReason;
  readonly resourceId?: string;
};

export class BillingMetricDroppedProblem extends Problem {
  readonly code = "metrics-billing/metric-dropped";
  readonly category = ProblemCategory.InternalServerError;

  constructor(options: BillingMetricDroppedProblemOptions) {
    super(
      undefined,
      undefined,
      `Billing metric dropped for ${options.eventName}: ${options.reason}`,
      {
        extensions: {
          eventName: options.eventName,
          tenantId: options.tenantId,
          eventKey: options.eventKey,
          reason: options.reason,
          ...(options.resourceId && { resourceId: options.resourceId }),
        },
      },
    );
  }
}

export type BillingMetricRecordingProblemOptions = {
  readonly eventName: string;
  readonly tenantId: string;
  readonly eventKey: string;
  readonly cause?: Error;
};

export class BillingMetricRecordingProblem extends Problem {
  readonly code = "metrics-billing/recording-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(options: BillingMetricRecordingProblemOptions) {
    super(undefined, undefined, `Billing metric recording failed for ${options.eventName}`, {
      cause: options.cause,
      extensions: {
        eventName: options.eventName,
        tenantId: options.tenantId,
        eventKey: options.eventKey,
      },
    });
  }
}

export class InvalidOrderPaymentReasonProblem extends Problem {
  readonly code = "metrics-billing/invalid-order-payment-reason";
  readonly category = ProblemCategory.InternalServerError;

  constructor(reason: unknown) {
    super(undefined, undefined, "OrderPaidEvent has an invalid payment reason", {
      extensions: {
        reason: typeof reason === "string" ? reason : null,
      },
    });
  }
}
