import { Problem, ProblemCategory } from '@croco/problems-core';
import type { NotificationChannel } from '../types';

export class NotificationProviderNotConfiguredProblem extends Problem {
  constructor(channel: NotificationChannel) {
    super(
      'notifications-core/provider-not-configured',
      ProblemCategory.InternalServerError,
      `No provider found for channel ${channel}`,
      {
        extensions: {
          channel,
          retryable: false,
        },
      }
    );
  }
}

export class NotificationProviderNotRegisteredProblem extends Problem {
  constructor(providerName: string) {
    super(
      'notifications-core/provider-not-registered',
      ProblemCategory.InternalServerError,
      `Provider ${providerName} is not registered`,
      {
        extensions: {
          providerName,
          retryable: false,
        },
      }
    );
  }
}

export class NotificationProviderNotFoundProblem extends Problem {
  constructor(providerName: string) {
    super(
      'notifications-core/provider-not-found',
      ProblemCategory.InternalServerError,
      `Provider ${providerName} not found`,
      {
        extensions: {
          providerName,
          retryable: false,
        },
      }
    );
  }
}

export class NotificationDeliveryFailedProblem extends Problem {
  constructor(providerName: string) {
    super(
      'notifications-core/delivery-failed',
      ProblemCategory.InternalServerError,
      'Notification failed without error details',
      {
        extensions: {
          providerName,
          retryable: true,
        },
      }
    );
  }
}
