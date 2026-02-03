import { FeatureManager } from '@croco/features-core';
import { Component, Context } from '@croco/framework-context';
import type { PostHogClientWrapper } from './PostHogClientWrapper';

@Component()
export class PostHogFeatureManager extends FeatureManager {
  constructor(private readonly posthogWrapper: PostHogClientWrapper) {
    super();
  }

  async isEnabled(key: string, context?: Record<string, unknown>): Promise<boolean> {
    const distinctId = this.getDistinctId(context);
    const groups = this.getGroups(context);

    // If API key is missing, default to false (safe fallback)
    if (this.posthogWrapper.client.getFeatureFlag === undefined) return false;

    const result = await this.posthogWrapper.client.isFeatureEnabled(key, distinctId, {
      groups,
      personProperties: context,
    });

    return result === true;
  }

  async getVariant(key: string, context?: Record<string, unknown>): Promise<string | boolean | number | object> {
    const distinctId = this.getDistinctId(context);
    const groups = this.getGroups(context);

    if (this.posthogWrapper.client.getFeatureFlag === undefined) return false;

    const result = await this.posthogWrapper.client.getFeatureFlag(key, distinctId, {
      groups,
      personProperties: context,
    });

    return result ?? false;
  }

  private getDistinctId(context?: Record<string, unknown>): string {
    if (context?.userId) return String(context.userId);

    // Auto-inject from AsyncLocalStorage
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
