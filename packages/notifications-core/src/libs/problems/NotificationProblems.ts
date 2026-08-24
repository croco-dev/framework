import { Problem, ProblemCategory } from "@croco/problems-core";
import type { NotificationChannel } from "../types";

type NotificationPreferenceProblemDecision = {
  readonly context: {
    readonly tenantId: string;
    readonly userId: string;
    readonly channel: NotificationChannel;
    readonly topic: string;
  };
  readonly reason: string;
  readonly ruleId?: string;
  readonly evaluationKey: string;
};

type NotificationTemplateProblemRef = {
  readonly id: string;
  readonly version: string;
  readonly locale: string;
};

type NotificationTemplateRenderProblemRequest = NotificationTemplateProblemRef & {
  readonly channel: NotificationChannel;
};

type NotificationTemplateProblemContract = NotificationTemplateProblemRef & {
  readonly channel: NotificationChannel;
};

export class NotificationProviderNotConfiguredProblem extends Problem {
  constructor(channel: NotificationChannel) {
    super(
      "notifications-core/provider-not-configured",
      ProblemCategory.InternalServerError,
      `No provider found for channel ${channel}`,
      {
        extensions: {
          channel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderNotRegisteredProblem extends Problem {
  constructor(providerName: string) {
    super(
      "notifications-core/provider-not-registered",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} is not registered`,
      {
        extensions: {
          providerName,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderAlreadyRegisteredProblem extends Problem {
  constructor(providerName: string) {
    super(
      "notifications-core/provider-already-registered",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} is already registered`,
      {
        extensions: {
          providerName,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderCapabilitiesMissingProblem extends Problem {
  constructor(providerName: string) {
    super(
      "notifications-core/provider-capabilities-missing",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} must declare an explicit capability profile`,
      {
        extensions: {
          providerName,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderCapabilityNameMismatchProblem extends Problem {
  constructor(providerName: string, capabilityProviderName: string) {
    super(
      "notifications-core/provider-capability-name-mismatch",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} declares capability profile for ${capabilityProviderName}`,
      {
        extensions: {
          providerName,
          capabilityProviderName,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderCapabilityChannelMismatchProblem extends Problem {
  constructor(
    providerName: string,
    providerChannel: NotificationChannel,
    capabilityChannels: readonly NotificationChannel[],
  ) {
    super(
      "notifications-core/provider-capability-channel-mismatch",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} capability profile does not include channel ${providerChannel}`,
      {
        extensions: {
          providerName,
          providerChannel,
          capabilityChannels,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationDefaultProviderConflictProblem extends Problem {
  constructor(channel: NotificationChannel, existingProviderName: string, providerName: string) {
    super(
      "notifications-core/default-provider-conflict",
      ProblemCategory.InternalServerError,
      `Default provider for channel ${channel} is already registered as ${existingProviderName}`,
      {
        extensions: {
          channel,
          existingProviderName,
          providerName,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderChannelMismatchProblem extends Problem {
  constructor(
    providerName: string,
    requestedChannel: NotificationChannel,
    actualChannel: NotificationChannel,
  ) {
    super(
      "notifications-core/provider-channel-mismatch",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} supports channel ${actualChannel}, not ${requestedChannel}`,
      {
        extensions: {
          providerName,
          requestedChannel,
          actualChannel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderNotFoundProblem extends Problem {
  constructor(providerName: string) {
    super(
      "notifications-core/provider-not-found",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} not found`,
      {
        extensions: {
          providerName,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationProviderIdempotencyUnsupportedProblem extends Problem {
  constructor(providerName: string, channel: NotificationChannel) {
    super(
      "notifications-core/provider-idempotency-unsupported",
      ProblemCategory.InternalServerError,
      `Provider ${providerName} cannot guarantee idempotent delivery on channel ${channel}`,
      {
        extensions: {
          providerName,
          channel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationSendMaxAttemptsInvalidProblem extends Problem {
  constructor(value: string) {
    super(
      "notifications-core/send-max-attempts-invalid",
      ProblemCategory.InternalServerError,
      `Invalid NOTIFICATIONS_SEND_MAX_ATTEMPTS value '${value}'. Must be an integer between 1 and 10.`,
      {
        extensions: {
          value,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationDeliveryFailedProblem extends Problem {
  constructor(providerName: string, cause?: Error) {
    super(
      "notifications-core/delivery-failed",
      ProblemCategory.InternalServerError,
      cause?.message ?? "Notification failed without error details",
      {
        cause,
        extensions: {
          providerName,
          retryable: true,
        },
      },
    );
  }
}

export class NotificationPreferenceDeniedProblem extends Problem {
  constructor(decision: NotificationPreferenceProblemDecision) {
    super(
      "notifications-core/preference-denied",
      ProblemCategory.BusinessRuleViolation,
      `Notification preference denied topic ${decision.context.topic} on channel ${decision.context.channel}`,
      {
        extensions: {
          tenantId: decision.context.tenantId,
          userId: decision.context.userId,
          channel: decision.context.channel,
          topic: decision.context.topic,
          reason: decision.reason,
          ruleId: decision.ruleId,
          evaluationKey: decision.evaluationKey,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationPreferenceContextRequiredProblem extends Problem {
  constructor(channel: NotificationChannel) {
    super(
      "notifications-core/preference-context-required",
      ProblemCategory.ValidationError,
      `Notification preference context is required before sending on channel ${channel}`,
      {
        extensions: {
          channel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationPreferenceChannelMismatchProblem extends Problem {
  constructor(requestedChannel: NotificationChannel, contextChannel: NotificationChannel) {
    super(
      "notifications-core/preference-channel-mismatch",
      ProblemCategory.ValidationError,
      `Notification preference context channel ${contextChannel} does not match requested channel ${requestedChannel}`,
      {
        extensions: {
          requestedChannel,
          contextChannel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationIdempotencyKeyRequiredProblem extends Problem {
  constructor(channel: NotificationChannel) {
    super(
      "notifications-core/idempotency-key-required",
      ProblemCategory.ValidationError,
      `Notification idempotency key is required before sending on channel ${channel}`,
      {
        extensions: {
          channel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationOutboxIdempotencyMismatchProblem extends Problem {
  constructor(channel: NotificationChannel) {
    super(
      "notifications-core/outbox-idempotency-mismatch",
      ProblemCategory.ValidationError,
      `Notification outbox idempotency key must match the dispatch idempotency key for channel ${channel}`,
      {
        extensions: {
          channel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationTemplateAlreadyRegisteredProblem extends Problem {
  constructor(template: NotificationTemplateProblemRef) {
    super(
      "notifications-core/template-already-registered",
      ProblemCategory.Conflict,
      `Notification template ${template.id}@${template.version} for ${template.locale} is already registered`,
      {
        extensions: {
          templateId: template.id,
          templateVersion: template.version,
          locale: template.locale,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationTemplateNotFoundProblem extends Problem {
  constructor(request: NotificationTemplateRenderProblemRequest) {
    super(
      "notifications-core/template-not-found",
      ProblemCategory.NotFound,
      `Notification template ${request.id}@${request.version} for ${request.locale} and channel ${request.channel} was not found`,
      {
        extensions: {
          templateId: request.id,
          templateVersion: request.version,
          locale: request.locale,
          channel: request.channel,
          retryable: false,
        },
      },
    );
  }
}

export class NotificationTemplateVariablesInvalidProblem extends Problem {
  constructor(template: NotificationTemplateProblemContract, issues: readonly string[]) {
    super(
      "notifications-core/template-variables-invalid",
      ProblemCategory.ValidationError,
      `Notification template ${template.id}@${template.version} variables are invalid`,
      {
        extensions: {
          templateId: template.id,
          templateVersion: template.version,
          locale: template.locale,
          channel: template.channel,
          issues,
          retryable: false,
        },
      },
    );
  }
}
