import { Component } from '@croco/framework-context';
import { Problem } from '@croco/problems-core';
import { Task } from '@croco/tasks-core';
import type { NotificationProviderRegistry } from './NotificationProviderRegistry';
import {
  NotificationDeliveryFailedProblem,
  NotificationProviderNotFoundProblem,
} from './problems/NotificationProblems';
import type { NotificationJobPayload, NotificationProvider } from './types';

const SEND_NOTIFICATION_MAX_ATTEMPTS = Number(process.env.NOTIFICATIONS_SEND_MAX_ATTEMPTS ?? 3);

@Component()
export class SendNotificationTask {
  constructor(private registry: NotificationProviderRegistry) {}

  registerProvider(provider: NotificationProvider) {
    this.registry.registerProvider(provider);
  }

  @Task({
    name: 'send-notification',
    maxAttempts: SEND_NOTIFICATION_MAX_ATTEMPTS,
  })
  async handle(payload: NotificationJobPayload): Promise<void> {
    const { providerName, idempotencyKey, ...notificationPayload } = payload;

    const provider = this.registry.getProvider(providerName);
    if (!provider) {
      throw new NotificationProviderNotFoundProblem(providerName);
    }

    const result =
      idempotencyKey === undefined
        ? await provider.send(notificationPayload)
        : await provider.send(notificationPayload, { idempotencyKey });

    if (!result.success) {
      if (result.error instanceof Problem || result.error instanceof Error) {
        throw result.error;
      }

      throw new NotificationDeliveryFailedProblem(providerName);
    }
  }
}
