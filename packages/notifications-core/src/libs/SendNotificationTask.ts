import { Component } from '@croco/framework-context';
import { Problem } from '@croco/problems-core';
import { Task } from '@croco/tasks-core';
import type { NotificationProviderRegistry } from './NotificationProviderRegistry';
import {
  NotificationDeliveryFailedProblem,
  NotificationProviderNotFoundProblem,
} from './problems/NotificationProblems';
import type { NotificationJobPayload, NotificationProvider } from './types';

@Component()
export class SendNotificationTask {
  constructor(private registry: NotificationProviderRegistry) {}

  registerProvider(provider: NotificationProvider) {
    this.registry.registerProvider(provider);
  }

  @Task({
    name: 'send-notification',
    maxAttempts: 3,
  })
  async handle(payload: NotificationJobPayload): Promise<void> {
    const { providerName, ...notificationPayload } = payload;

    const provider = this.registry.getProvider(providerName);
    if (!provider) {
      throw new NotificationProviderNotFoundProblem(providerName);
    }

    const result = await provider.send(notificationPayload);

    if (!result.success) {
      if (result.error instanceof Problem || result.error instanceof Error) {
        throw result.error;
      }

      throw new NotificationDeliveryFailedProblem(providerName);
    }
  }
}
