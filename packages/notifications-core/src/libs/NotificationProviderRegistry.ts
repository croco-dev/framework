import { Component } from '@croco/framework-context';
import {
  NotificationDefaultProviderConflictProblem,
  NotificationProviderAlreadyRegisteredProblem,
} from './problems/NotificationProblems';
import type { NotificationChannel, NotificationProvider } from './types';

@Component()
export class NotificationProviderRegistry {
  private providers = new Map<string, NotificationProvider>();
  private defaultProviders = new Map<NotificationChannel, string>();

  registerProvider(provider: NotificationProvider, isDefault = false): void {
    const providerName = provider.getName();

    if (this.providers.has(providerName)) {
      throw new NotificationProviderAlreadyRegisteredProblem(providerName);
    }

    if (!isDefault) {
      this.providers.set(providerName, provider);
      return;
    }

    const channel = provider.getChannel();
    const existingDefaultProvider = this.defaultProviders.get(channel);

    if (existingDefaultProvider !== undefined) {
      throw new NotificationDefaultProviderConflictProblem(channel, existingDefaultProvider, providerName);
    }

    this.providers.set(providerName, provider);
    this.defaultProviders.set(channel, providerName);
  }

  hasProvider(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  getDefaultProviderName(channel: NotificationChannel): string | undefined {
    return this.defaultProviders.get(channel);
  }

  getProvider(providerName: string): NotificationProvider | undefined {
    return this.providers.get(providerName);
  }
}
