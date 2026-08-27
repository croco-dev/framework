// Constructor dependencies must remain runtime values for emitted design:paramtypes metadata.
/* oxlint-disable typescript/consistent-type-imports */
import { FeatureManager } from "@croco/features-core";
import { Component, Context } from "@croco/framework-context";
import { PostHogClient } from "@croco/integrations-posthog";

type PostHogProperties = Record<string, string>;

/**
 * PostHog feature flag를 조회하는 FeatureManager 구현체입니다.
 */
@Component()
export class PostHogFeatureManager extends FeatureManager {
  constructor(private readonly posthogClient: PostHogClient) {
    super();
  }

  async isEnabled(flag: string, context?: Record<string, unknown>): Promise<boolean> {
    const distinctId = this.getDistinctId(context);
    const groups = this.getGroups(context);
    const personProperties = this.toPostHogProperties(context);

    const isEnabled = await this.posthogClient.getClient().isFeatureEnabled(flag, distinctId, {
      groups,
      personProperties,
    });

    return isEnabled === true;
  }

  async getVariant(
    flag: string,
    context?: Record<string, unknown>,
  ): Promise<string | boolean | object> {
    const distinctId = this.getDistinctId(context);
    const groups = this.getGroups(context);
    const personProperties = this.toPostHogProperties(context);

    const variant = await this.posthogClient.getClient().getFeatureFlag(flag, distinctId, {
      groups,
      personProperties,
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

    const requestId = Context.getRequestId();
    if (requestId) return `anonymous:${requestId}`;

    const tenantId = this.getExplicitTenantId(context) ?? Context.getTenantId();
    if (tenantId) return `tenant:${tenantId}`;

    return "anonymous";
  }

  private getGroups(context?: Record<string, unknown>): Record<string, string> | undefined {
    const groups = this.toStringRecord(context?.groups);
    if (groups) return groups;

    const tenantId = this.getExplicitTenantId(context) ?? Context.getTenantId();
    if (tenantId) {
      return { tenant: tenantId };
    }

    return undefined;
  }

  private toPostHogProperties(context?: Record<string, unknown>): PostHogProperties | undefined {
    const properties = this.toStringRecord(context);
    if (!properties) return undefined;

    if (context?.tenantId !== undefined && this.getExplicitTenantId(context) === undefined) {
      delete properties.tenantId;
    }

    return Object.keys(properties).length > 0 ? properties : undefined;
  }

  private getExplicitTenantId(context?: Record<string, unknown>): string | undefined {
    const tenantId = context?.tenantId;
    return typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId : undefined;
  }

  private toStringRecord(value: unknown): PostHogProperties | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const result: PostHogProperties = {};

    for (const [key, entryValue] of Object.keys(value).map(
      (key) => [key, (value as Record<string, unknown>)[key]] as const,
    )) {
      if (
        entryValue === undefined ||
        typeof entryValue === "object" ||
        typeof entryValue === "function"
      ) {
        continue;
      }

      result[key] = String(entryValue);
    }

    if (Object.keys(result).length === 0) {
      return undefined;
    }

    return result;
  }
}
