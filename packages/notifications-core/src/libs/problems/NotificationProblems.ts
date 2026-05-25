import { Problem, ProblemCategory } from "@croco/problems-core";
import type { NotificationChannel } from "../types";

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
  constructor(providerName: string) {
    super(
      "notifications-core/delivery-failed",
      ProblemCategory.InternalServerError,
      "Notification failed without error details",
      {
        extensions: {
          providerName,
          retryable: true,
        },
      },
    );
  }
}
