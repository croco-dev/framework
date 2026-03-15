import { AnalyticsManager } from '@croco/analytics-core';
import { Component, Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { PostHogClient } from '@croco/integrations-posthog';
import { getDistinctId, getGroups } from './utils';

@Component()
export class PostHogAnalyticsManager extends AnalyticsManager {
  constructor(
    private readonly posthogClient: PostHogClient,
    private readonly logger: Logger = Container.get(Logger)
  ) {
    super();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    const distinctId = getDistinctId(properties);
    const groups = getGroups(properties);

    try {
      const result = this.posthogClient.getClient().capture({
        distinctId,
        event,
        properties,
        groups,
      });

      Promise.resolve(result).catch((error: unknown) => {
        this.logCaptureFailure(event, error);
      });
    } catch (error) {
      this.logCaptureFailure(event, error);
    }
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    this.posthogClient.getClient().identify({
      distinctId,
      properties,
    });
  }

  group(groupType: string, groupKey: string, properties?: Record<string, unknown>): void {
    this.posthogClient.getClient().groupIdentify({
      groupType,
      groupKey,
      properties,
    });
  }

  private logCaptureFailure(event: string, error: unknown): void {
    this.logger.warn('PostHog capture failed', {
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
