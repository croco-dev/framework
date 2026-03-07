import { Component } from '@croco/framework-context';
import { PostHog } from 'posthog-node';

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

@Component()
export class PostHogClient {
  private client: PostHog;

  constructor(config: PostHogConfig) {
    const host = config.host ?? process.env.POSTHOG_HOST ?? 'https://app.posthog.com';

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
