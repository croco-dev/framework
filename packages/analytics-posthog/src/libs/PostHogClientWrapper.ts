import { Component } from '@croco/framework-context';
import { PostHog } from 'posthog-node';

@Component({ scope: 'singleton' })
export class PostHogClientWrapper {
  public readonly client: PostHog;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY;
    const host = process.env.POSTHOG_HOST || 'https://app.posthog.com';

    if (!apiKey) {
      console.warn('POSTHOG_API_KEY is not set. PostHog integration will be disabled.');
    }

    this.client = new PostHog(apiKey || 'dummy', {
      host,
      flushAt: 1, // For serverless, flush immediately or handle gracefully
      flushInterval: 0,
    });
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
