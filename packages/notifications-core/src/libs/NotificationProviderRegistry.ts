import { Component } from "@croco/framework-context";
import {
  NotificationDefaultProviderConflictProblem,
  NotificationProviderAlreadyRegisteredProblem,
  NotificationProviderCapabilitiesMissingProblem,
  NotificationProviderCapabilityChannelMismatchProblem,
  NotificationProviderCapabilityNameMismatchProblem,
} from "./problems/NotificationProblems";
import type {
  NotificationChannel,
  NotificationProvider,
  NotificationProviderCapabilities,
} from "./types";

type RegisteredNotificationProvider = {
  readonly capabilities: NotificationProviderCapabilities;
  readonly provider: NotificationProvider;
};

@Component()
export class NotificationProviderRegistry {
  private providers = new Map<string, RegisteredNotificationProvider>();
  private defaultProviders = new Map<NotificationChannel, string>();

  registerProvider(provider: NotificationProvider, isDefault = false): void {
    const providerName = provider.getName();

    if (this.providers.has(providerName)) {
      throw new NotificationProviderAlreadyRegisteredProblem(providerName);
    }

    const channel = provider.getChannel();

    if (typeof provider.getCapabilities !== "function") {
      throw new NotificationProviderCapabilitiesMissingProblem(providerName);
    }

    const declaredCapabilities = provider.getCapabilities();

    if (declaredCapabilities == null) {
      throw new NotificationProviderCapabilitiesMissingProblem(providerName);
    }

    if (declaredCapabilities.providerName !== providerName) {
      throw new NotificationProviderCapabilityNameMismatchProblem(
        providerName,
        declaredCapabilities.providerName,
      );
    }

    if (!declaredCapabilities.channels.includes(channel)) {
      throw new NotificationProviderCapabilityChannelMismatchProblem(
        providerName,
        channel,
        declaredCapabilities.channels,
      );
    }

    const capabilities: NotificationProviderCapabilities = Object.freeze({
      ...declaredCapabilities,
      channels: Object.freeze([...declaredCapabilities.channels]),
    });

    if (!isDefault) {
      this.providers.set(providerName, { capabilities, provider });
      return;
    }

    const existingDefaultProvider = this.defaultProviders.get(channel);

    if (existingDefaultProvider !== undefined) {
      throw new NotificationDefaultProviderConflictProblem(
        channel,
        existingDefaultProvider,
        providerName,
      );
    }

    this.providers.set(providerName, { capabilities, provider });
    this.defaultProviders.set(channel, providerName);
  }

  hasProvider(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  getDefaultProviderName(channel: NotificationChannel): string | undefined {
    return this.defaultProviders.get(channel);
  }

  getProvider(providerName: string): NotificationProvider | undefined {
    return this.providers.get(providerName)?.provider;
  }

  getProviderCapabilities(providerName: string): NotificationProviderCapabilities | undefined {
    return this.providers.get(providerName)?.capabilities;
  }
}
