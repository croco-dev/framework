import { FeatureManager } from '@croco/features-core';
import { Component, Context } from '@croco/framework-context';
import type { PostHogClient } from '@croco/integrations-posthog';

@Component()
export class PostHogFeatureManager extends FeatureManager {
  constructor(private readonly posthogClient: PostHogClient) {
    super();
  }

  async isEnabled(flag: string, context?: Record<string, unknown>): Promise<boolean> {
    const distinctId = this.getDistinctId(context);
    const groups = this.getGroups(context);

    const isEnabled = await this.posthogClient.getClient().isFeatureEnabled(flag, distinctId, {
      groups: groups as any,
      personProperties: context as any,
    });

    return isEnabled === true;
  }

  async getVariant(flag: string, context?: Record<string, unknown>): Promise<string | boolean | object> {
    const distinctId = this.getDistinctId(context);
    const groups = this.getGroups(context);

    const variant = await this.posthogClient.getClient().getFeatureFlag(flag, distinctId, {
      groups: groups as any,
      personProperties: context as any,
    });

    if (variant === undefined || variant === null) {
      return false;
    }

    return variant;
  }

  private getDistinctId(context?: Record<string, unknown>): string {
    if (context?.userId) return String(context.userId);

    const user = Context.getCurrentUser();
    if (user?.id) return user.id;

    const tenantId = Context.getTenantId();
    if (tenantId) return `tenant:${tenantId}`;

    return 'anonymous';
  }

  private getGroups(context?: Record<string, unknown>): Record<string, string> | undefined {
    if (context?.groups) return context.groups as Record<string, string>;

    const tenantId = Context.getTenantId();
    if (tenantId) {
      return { tenant: tenantId };
    }

    return undefined;
  }
}
