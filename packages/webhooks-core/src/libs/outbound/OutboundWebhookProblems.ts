import { Problem, ProblemCategory } from "@croco/problems-core";

export const OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES = {
  acceptanceUnknown: "webhooks-core/outbound-acceptance-unknown",
  configuration: "webhooks-core/outbound-configuration",
  endpointNotFound: "webhooks-core/outbound-endpoint-not-found",
  invalidEvent: "webhooks-core/outbound-invalid-event",
  invalidSecretVersion: "webhooks-core/outbound-invalid-secret-version",
  invalidUrl: "webhooks-core/outbound-invalid-url",
  permanentFailure: "webhooks-core/outbound-permanent-failure",
  replayNotAllowed: "webhooks-core/outbound-replay-not-allowed",
  retryableFailure: "webhooks-core/outbound-retryable-failure",
} as const;

export type OutboundWebhookDiagnosticCode =
  (typeof OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES)[keyof typeof OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES];

class OutboundWebhookProblem extends Problem {
  constructor(
    code: OutboundWebhookDiagnosticCode,
    category: ProblemCategory,
    detail: string,
    extensions: Record<string, unknown>,
  ) {
    super(code, category, detail, { extensions });
  }
}

export class InvalidOutboundWebhookEventProblem extends OutboundWebhookProblem {
  constructor(reason: string, eventId?: string) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.invalidEvent,
      ProblemCategory.ValidationError,
      `Invalid outbound webhook event: ${reason}`,
      eventId === undefined ? {} : { eventId },
    );
  }
}

export class InvalidOutboundWebhookUrlProblem extends OutboundWebhookProblem {
  constructor(reason: string, endpointId?: string) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.invalidUrl,
      ProblemCategory.ValidationError,
      `Outbound webhook endpoint URL is not allowed: ${reason}`,
      endpointId === undefined ? {} : { endpointId },
    );
  }
}

export class OutboundWebhookEndpointNotFoundProblem extends OutboundWebhookProblem {
  constructor(endpointId: string) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.endpointNotFound,
      ProblemCategory.NotFound,
      `Outbound webhook endpoint '${endpointId}' was not found`,
      { endpointId },
    );
  }
}

export class InvalidOutboundWebhookSecretVersionProblem extends OutboundWebhookProblem {
  constructor(endpointId: string, secretVersion: string, reason: "expired" | "unknown") {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.invalidSecretVersion,
      ProblemCategory.ValidationError,
      `Outbound webhook signing secret version is ${reason}`,
      { endpointId, secretVersion, reason },
    );
  }
}

export class OutboundWebhookRetryableProblem extends OutboundWebhookProblem {
  constructor(deliveryId: string, reason: string, evidence: Record<string, unknown> = {}) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.retryableFailure,
      ProblemCategory.InternalServerError,
      `Outbound webhook delivery can be retried: ${reason}`,
      { deliveryId, ...evidence },
    );
  }
}

export class OutboundWebhookPermanentProblem extends OutboundWebhookProblem {
  constructor(deliveryId: string, reason: string, evidence: Record<string, unknown> = {}) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.permanentFailure,
      ProblemCategory.BusinessRuleViolation,
      `Outbound webhook delivery failed permanently: ${reason}`,
      { deliveryId, ...evidence },
    );
  }
}

export class OutboundWebhookAcceptanceUnknownProblem extends OutboundWebhookProblem {
  constructor(deliveryId: string, reason: string) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.acceptanceUnknown,
      ProblemCategory.Conflict,
      `Outbound webhook acceptance is unknown: ${reason}`,
      { deliveryId },
    );
  }
}

export class OutboundWebhookReplayNotAllowedProblem extends OutboundWebhookProblem {
  constructor(deliveryId: string, status: string) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.replayNotAllowed,
      ProblemCategory.Conflict,
      `Outbound webhook delivery '${deliveryId}' cannot be replayed from status '${status}'`,
      { deliveryId, status },
    );
  }
}

export class OutboundWebhookConfigurationProblem extends OutboundWebhookProblem {
  constructor(reason: string, extensions: Record<string, unknown> = {}) {
    super(
      OUTBOUND_WEBHOOK_DIAGNOSTIC_CODES.configuration,
      ProblemCategory.InternalServerError,
      `Invalid outbound webhook configuration: ${reason}`,
      extensions,
    );
  }
}
