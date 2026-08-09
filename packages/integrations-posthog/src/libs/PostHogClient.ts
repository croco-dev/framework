import { Component, Inject } from "@croco/framework-context";
import { PostHog } from "posthog-node";

import {
  POSTHOG_CONFIG_TOKEN,
  validatePostHogConfig,
  warnAboutEnvironmentHost,
} from "./PostHogConfig";
import type { PostHogConfig } from "./PostHogConfig";

export type { PostHogConfig } from "./PostHogConfig";

@Component()
export class PostHogClient {
  private client: PostHog;

  constructor(@Inject(POSTHOG_CONFIG_TOKEN) config: PostHogConfig) {
    const host = validatePostHogConfig(config);

    if (!config.host) {
      warnAboutEnvironmentHost();
    }

    this.client = new PostHog(config.apiKey, {
      host,
    });
  }

  getClient(): PostHog {
    return this.client;
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
