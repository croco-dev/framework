import { Component } from '@croco/framework-context';
import { Task } from '@croco/tasks-core';
import type { NotificationJobPayload, NotificationProvider } from './types';

@Component()
export class SendNotificationTask {
  private providers = new Map<string, NotificationProvider>();

  registerProvider(provider: NotificationProvider) {
    this.providers.set(provider.getName(), provider);
  }

  @Task({
    name: 'send-notification',
    maxAttempts: 3,
  })
  async handle(payload: NotificationJobPayload): Promise<void> {
    const { providerName, ...notificationPayload } = payload;

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const result = await provider.send(notificationPayload);

    if (!result.success) {
      throw result.error || new Error('Notification failed without error details');
    }
  }
}
