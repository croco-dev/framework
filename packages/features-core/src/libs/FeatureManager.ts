import { Token } from '@croco/framework-context';

export abstract class FeatureManager {
  static readonly token = new Token<FeatureManager>('FeatureManager');

  /**
   * Check if a feature flag is enabled.
   * Context (userId, tenantId) will be automatically injected by the implementation if available,
   * but can be overridden by the `context` parameter.
   */
  abstract isEnabled(key: string, context?: Record<string, unknown>): Promise<boolean>;

  /**
   * Get the value of a feature flag.
   * Useful for multivariate flags or JSON configuration.
   */
  abstract getVariant(key: string, context?: Record<string, unknown>): Promise<string | boolean | number | object>;
}
