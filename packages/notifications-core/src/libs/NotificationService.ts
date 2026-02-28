import { Component } from '@croco/framework-context';
import type { TaskRunner } from '@croco/tasks-core';
import type { NotificationProviderRegistry } from './NotificationProviderRegistry';
import type { NotificationChannel, NotificationJobPayload, NotificationPayload, NotificationProvider } from './types';

@Component()
export class NotificationService {
  constructor(
    private taskRunner: TaskRunner,
    private registry: NotificationProviderRegistry
  ) {}

  registerProvider(provider: NotificationProvider, isDefault = false) {
    this.registry.registerProvider(provider, isDefault);
  }

  /**
   * Send a notification asynchronously via Job Queue
   */
  async send(channel: NotificationChannel, payload: NotificationPayload, providerName?: string): Promise<void> {
    const targetProviderName = providerName || this.registry.getDefaultProviderName(channel);

    if (!targetProviderName) {
      throw new Error(`No provider found for channel ${channel}`);
    }

    if (!this.registry.hasProvider(targetProviderName)) {
      throw new Error(`Provider ${targetProviderName} is not registered`);
    }

    const jobPayload: NotificationJobPayload = {
      ...payload,
      providerName: targetProviderName,
    };

    await this.taskRunner.execute('send-notification', jobPayload);
  }
}
