import { randomUUID } from 'node:crypto';
import { AnalyticsManager } from '@croco/analytics-core';
import { Component, Context } from '@croco/framework-context';
import type { PostHogClient } from '@croco/integrations-posthog';

@Component()
export class PostHogAnalyticsManager extends AnalyticsManager {
  constructor(private readonly posthogClient: PostHogClient) {
    super();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    const distinctId = this.getDistinctId(properties);
    const groups = this.getGroups(properties);

    this.posthogClient.getClient().capture({
      distinctId,
      event,
      properties,
      groups,
    });
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

  private getDistinctId(properties?: Record<string, unknown>): string {
    if (properties?.userId) return String(properties.userId);

    const user = Context.getCurrentUser();
    if (user?.id) return user.id;

    const requestId = Context.getRequestId();
    if (requestId) return `anonymous:${requestId}`;

    const tenantId = Context.getTenantId();
    if (tenantId) return `tenant:${tenantId}`;

    return `anonymous:${randomUUID()}`;
  }

  private getGroups(properties?: Record<string, unknown>): Record<string, string> | undefined {
    if (properties?.groups) return properties.groups as Record<string, string>;

    const tenantId = Context.getTenantId();
    if (tenantId) {
      return { tenant: tenantId };
    }

    return undefined;
  }
}
