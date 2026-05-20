import { Component, Container, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import { PostHog } from "posthog-node";
import { PostHogConfigProblem } from "./problems/PostHogProblems";

export interface PostHogConfig {
  apiKey: string;
  host?: string;
}

@Component()
export class PostHogClient {
  private client: PostHog;

  constructor(config: PostHogConfig) {
    const envHost = process.env.POSTHOG_HOST;
    const host = config.host ?? envHost;

    if (!host) {
      throw new PostHogConfigProblem(
        "[PostHogClient] PostHog host is required for data residency compliance. " +
          "Set host in config or POSTHOG_HOST env var. " +
          "Default (app.posthog.com) routes data to US servers.",
      );
    }

    if (!config.host && envHost) {
      const logger = Container.get(LOGGER_TOKEN) as ILogger;
      logger.warn(
        "[PostHogClient] POSTHOG_HOST env var is used for PostHog host. " +
          "Set host explicitly in config to confirm data residency compliance.",
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
