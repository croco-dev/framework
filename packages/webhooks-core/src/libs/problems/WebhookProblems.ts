import { Problem, ProblemCategory, type ProblemOptions } from "@croco/problems-core";

export const WEBHOOK_DIAGNOSTIC_CODES = {
  configuration: "webhooks-core/configuration",
  dispatchFailed: "webhooks-core/dispatch-failed",
  duplicateEvent: "webhooks-core/duplicate-event",
  invalidFixture: "webhooks-core/invalid-fixture",
  invalidEnvelope: "webhooks-core/invalid-envelope",
  invalidSignature: "webhooks-core/invalid-signature",
  reporterFailed: "webhooks-core/reporter-failed",
  unknownEvent: "webhooks-core/unknown-event",
} as const;

export type WebhookDiagnosticCode =
  (typeof WEBHOOK_DIAGNOSTIC_CODES)[keyof typeof WEBHOOK_DIAGNOSTIC_CODES];

type WebhookProblemOptions = {
  readonly code: WebhookDiagnosticCode;
  readonly category: ProblemCategory;
  readonly detail: string;
  readonly extensions?: Record<string, unknown>;
  readonly cause?: Error;
};

class WebhookProblem extends Problem {
  constructor(options: WebhookProblemOptions) {
    const problemOptions: ProblemOptions = {
      extensions: options.extensions,
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    };

    super(options.code, options.category, options.detail, problemOptions);
  }
}

export class WebhookGatewayConfigurationProblem extends WebhookProblem {
  constructor(reason: string, extensions: Record<string, unknown> = {}) {
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.configuration,
      category: ProblemCategory.InternalServerError,
      detail: `Invalid webhook gateway configuration: ${reason}`,
      extensions,
    });
  }
}

export class InvalidWebhookSignatureProblem extends WebhookProblem {
  constructor(options: {
    readonly provider: string;
    readonly reason: string;
    readonly eventId?: string;
    readonly eventType?: string;
  }) {
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.invalidSignature,
      category: ProblemCategory.BadRequest,
      detail: `Webhook signature verification failed for provider '${options.provider}': ${options.reason}`,
      extensions: {
        provider: options.provider,
        ...(options.eventId === undefined ? {} : { eventId: options.eventId }),
        ...(options.eventType === undefined ? {} : { eventType: options.eventType }),
      },
    });
  }
}

export class InvalidWebhookEnvelopeProblem extends WebhookProblem {
  constructor(options: {
    readonly provider: string;
    readonly reason: string;
    readonly eventId?: string;
    readonly eventType?: string;
  }) {
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.invalidEnvelope,
      category: ProblemCategory.BadRequest,
      detail: `Webhook envelope from provider '${options.provider}' is invalid: ${options.reason}`,
      extensions: {
        provider: options.provider,
        ...(options.eventId === undefined ? {} : { eventId: options.eventId }),
        ...(options.eventType === undefined ? {} : { eventType: options.eventType }),
      },
    });
  }
}

export class UnknownWebhookEventProblem extends WebhookProblem {
  constructor(options: {
    readonly provider: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly policy: "fail" | "ignore" | "report";
  }) {
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.unknownEvent,
      category: ProblemCategory.BadRequest,
      detail: `Webhook event '${options.eventType}' from provider '${options.provider}' has no registered handler`,
      extensions: {
        provider: options.provider,
        eventId: options.eventId,
        eventType: options.eventType,
        policy: options.policy,
      },
    });
  }
}

export class WebhookDispatchProblem extends WebhookProblem {
  constructor(options: {
    readonly provider: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly reason: string;
    readonly cause?: Error;
  }) {
    const cause = options.cause;
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.dispatchFailed,
      category: ProblemCategory.InternalServerError,
      detail: `Webhook handler failed for provider '${options.provider}' event '${options.eventType}' (${options.eventId}): ${options.reason}`,
      extensions: {
        provider: options.provider,
        eventId: options.eventId,
        eventType: options.eventType,
        ...(cause instanceof Problem ? { causeCode: cause.code } : {}),
      },
      ...(cause === undefined ? {} : { cause }),
    });
  }
}

export class DuplicateWebhookEventProblem extends WebhookProblem {
  constructor(options: {
    readonly provider: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly state: "completed" | "in-flight" | "failed";
  }) {
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.duplicateEvent,
      category: ProblemCategory.Conflict,
      detail: `Webhook event '${options.eventType}' (${options.eventId}) from provider '${options.provider}' is already ${options.state}`,
      extensions: {
        provider: options.provider,
        eventId: options.eventId,
        eventType: options.eventType,
        state: options.state,
      },
    });
  }
}

export class WebhookReporterProblem extends WebhookProblem {
  constructor(options: {
    readonly provider: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly reason: string;
    readonly cause?: Error;
  }) {
    const cause = options.cause;
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.reporterFailed,
      category: ProblemCategory.InternalServerError,
      detail: `Webhook unknown-event reporter failed for provider '${options.provider}' event '${options.eventType}' (${options.eventId}): ${options.reason}`,
      extensions: {
        provider: options.provider,
        eventId: options.eventId,
        eventType: options.eventType,
      },
      ...(cause === undefined ? {} : { cause }),
    });
  }
}

export class InvalidWebhookFixtureProblem extends WebhookProblem {
  constructor(reason: string, extensions: Record<string, unknown> = {}) {
    super({
      code: WEBHOOK_DIAGNOSTIC_CODES.invalidFixture,
      category: ProblemCategory.BadRequest,
      detail: `Invalid webhook replay fixture: ${reason}`,
      extensions,
    });
  }
}
