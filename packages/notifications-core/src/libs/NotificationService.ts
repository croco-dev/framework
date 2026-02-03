import { Component } from '@croco/framework-context';
import type { JobDispatcher } from '@croco/jobs-core';
import type { NotificationChannel, NotificationJobPayload, NotificationPayload, NotificationProvider } from './types';

@Component()
export class NotificationService {
  private providers = new Map<string, NotificationProvider>();
  private defaultProviders = new Map<NotificationChannel, string>();

  constructor(private jobDispatcher: JobDispatcher) {}

  registerProvider(provider: NotificationProvider, isDefault = false) {
    this.providers.set(provider.getName(), provider);
    if (isDefault) {
      this.defaultProviders.set(provider.getChannel(), provider.getName());
    }
  }

  /**
   * Send a notification asynchronously via Job Queue
   */
  async send(channel: NotificationChannel, payload: NotificationPayload, providerName?: string): Promise<void> {
    const targetProviderName = providerName || this.defaultProviders.get(channel);

    if (!targetProviderName) {
      throw new Error(`No provider found for channel ${channel}`);
    }

    if (!this.providers.has(targetProviderName)) {
      throw new Error(`Provider ${targetProviderName} is not registered`);
    }

    const jobPayload: NotificationJobPayload = {
      ...payload,
      providerName: targetProviderName,
    };

    await this.jobDispatcher.dispatch('send-notification', jobPayload);
  }
}
