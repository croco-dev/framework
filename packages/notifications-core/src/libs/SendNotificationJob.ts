import { Job, type JobHandler } from '@croco/jobs-core';
import type { NotificationJobPayload, NotificationProvider } from './types';

@Job('send-notification', {
  retryPolicy: {
    maxAttempts: 3,
    // backoff is not supported in current version of jobs-core based on inspection
    // assuming default backoff or configured globally
  },
})
export class SendNotificationJob implements JobHandler<NotificationJobPayload> {
  private providers = new Map<string, NotificationProvider>();

  registerProvider(provider: NotificationProvider) {
    this.providers.set(provider.getName(), provider);
  }

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
