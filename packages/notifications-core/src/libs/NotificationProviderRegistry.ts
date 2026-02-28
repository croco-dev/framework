import { Component } from '@croco/framework-context';
import type { NotificationChannel, NotificationProvider } from './types';

@Component()
export class NotificationProviderRegistry {
  private providers = new Map<string, NotificationProvider>();
  private defaultProviders = new Map<NotificationChannel, string>();

  registerProvider(provider: NotificationProvider, isDefault = false): void {
    const providerName = provider.getName();
    this.providers.set(providerName, provider);

    if (!isDefault) {
      return;
    }

    this.defaultProviders.set(provider.getChannel(), providerName);
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
