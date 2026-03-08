import { Component } from '@croco/framework-context';
import type { TaskRunner } from '@croco/tasks-core';
import type { NotificationProviderRegistry } from './NotificationProviderRegistry';
import {
  NotificationProviderNotConfiguredProblem,
  NotificationProviderNotRegisteredProblem,
} from './problems/NotificationProblems';
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
   * Send a notification via task execution.
   *
   * This method waits for the configured TaskRunner to execute the
   * `send-notification` task, so task and provider failures are propagated
   * back to the caller.
   */
  async send(channel: NotificationChannel, payload: NotificationPayload, providerName?: string): Promise<void> {
    const targetProviderName = providerName || this.registry.getDefaultProviderName(channel);

    if (!targetProviderName) {
      throw new NotificationProviderNotConfiguredProblem(channel);
    }

    if (!this.registry.hasProvider(targetProviderName)) {
      throw new NotificationProviderNotRegisteredProblem(targetProviderName);
    }

    const jobPayload: NotificationJobPayload = {
      ...payload,
      providerName: targetProviderName,
    };

    await this.taskRunner.execute('send-notification', jobPayload);
  }
}
