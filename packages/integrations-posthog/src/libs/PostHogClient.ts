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
    const validConfig = validatePostHogConfig(config);

    if (!config.host) {
      warnAboutEnvironmentHost();
    }

    this.client = new PostHog(validConfig.apiKey, {
      host: validConfig.host,
    });
  }

  getClient(): PostHog {
    return this.client;
  }

  async flush(): Promise<void> {
    // posthog-node schedules capture queue insertion asynchronously before flush reads the queue.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await this.client.flush();
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
