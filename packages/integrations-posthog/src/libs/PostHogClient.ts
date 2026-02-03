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
    this.client = new PostHog(config.apiKey, {
      host: config.host || 'https://app.posthog.com',
    });
  }

  getClient(): PostHog {
    return this.client;
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
