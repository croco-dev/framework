import { Component } from '@croco/framework-context';
import { PostHog } from 'posthog-node';
import { PostHogConfigProblem } from './problems/PostHogProblems';

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

@Component()
export class PostHogClient {
  private client: PostHog;

  constructor(config: PostHogConfig) {
    const host = config.host ?? process.env.POSTHOG_HOST;

    if (!host) {
      throw new PostHogConfigProblem(
        '[PostHogClient] PostHog host is required. ' + 'Set POSTHOG_HOST environment variable or pass host in config.'
      );
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
