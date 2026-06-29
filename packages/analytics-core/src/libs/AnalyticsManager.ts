import { Token } from "@croco/framework-context";

export abstract class AnalyticsManager {
  static readonly token = new Token<AnalyticsManager>("AnalyticsManager");

  /**
   * Capture an event.
   * `userId` and `tenantId` will be automatically injected from Context if available.
   */
  abstract capture(event: string, properties?: Record<string, unknown>): void;

  /**
   * Identify a user.
   * Typically called after login or registration.
   */
  abstract identify(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Associate a user with a group (e.g., Tenant, Organization).
   * Essential for B2B SaaS analytics.
   */
  abstract group(groupType: string, groupKey: string, properties?: Record<string, unknown>): void;

  /**
   * Flush buffered analytics events before a runtime boundary such as Lambda return or shutdown.
   */
  flush(): Promise<void> {
    return Promise.resolve();
  }
}
