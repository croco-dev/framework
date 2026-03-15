import { getDistinctId, getGroups, toStringRecord } from '@croco/analytics-posthog';
import { FeatureManager } from '@croco/features-core';
import { Component } from '@croco/framework-context';
import type { PostHogClient } from '@croco/integrations-posthog';

@Component()
export class PostHogFeatureManager extends FeatureManager {
  constructor(private readonly posthogClient: PostHogClient) {
    super();
  }

  async isEnabled(flag: string, context?: Record<string, unknown>): Promise<boolean> {
    const distinctId = getDistinctId(context);
    const groups = getGroups(context);
    const personProperties = toStringRecord(context);

    const isEnabled = await this.posthogClient.getClient().isFeatureEnabled(flag, distinctId, {
      groups,
      personProperties,
    });

    return isEnabled === true;
  }

  async getVariant(flag: string, context?: Record<string, unknown>): Promise<string | boolean | object> {
    const distinctId = getDistinctId(context);
    const groups = getGroups(context);
    const personProperties = toStringRecord(context);

    const variant = await this.posthogClient.getClient().getFeatureFlag(flag, distinctId, {
      groups,
      personProperties,
    });

    if (variant === undefined || variant === null) {
      return false;
    }

    return variant;
  }
}
