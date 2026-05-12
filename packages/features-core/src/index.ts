/**
 * @packageDocumentation
 *
 * @description
 * Feature flag management system for Croco framework. Provides an abstraction layer for implementing feature toggles
 * with support for boolean flags, multivariate variants, and context-aware evaluations.
 *
 * @example
 * ```typescript
 * import { FeatureManager } from '@croco/features-core';
 *
 * // Implement a custom feature manager
 * class MyFeatureManager extends FeatureManager {
 *   async isEnabled(key: string, context?: Record<string, unknown>): Promise<boolean> {
 *     // Your implementation logic here
 *     return true;
 *   }
 *
 *   async getVariant(key: string, context?: Record<string, unknown>): Promise<string | boolean | number | object> {
 *     // Your implementation logic here
 *     return 'default';
 *   }
 * }
 * ```
 */

/**
 * Feature flag manager abstract class.
 *
 * @description
 * Provides an interface for feature flag management with support for:
 * - Boolean feature flags (enabled/disabled)
 * - Multivariate feature flags (A/B testing, staged rollouts)
 * - Context-aware flag evaluation (userId, tenantId, etc.)
 *
 * Concrete implementations should integrate with feature flag services like LaunchDarkly,
 * Flagsmith, or custom configuration sources.
 *
 * @example
 * ```typescript
 * import { Container } from '@croco/framework-context';
 * import { FeatureManager } from '@croco/features-core';
 *
 * // Register your implementation
 * class CustomFeatureManager extends FeatureManager {
 *   async isEnabled(key: string, context?: Record<string, unknown>): Promise<boolean> {
 *     // Check database, API, or configuration
 *     return config.features[key]?.enabled ?? false;
 *   }
 *
 *   async getVariant(key: string, context?: Record<string, unknown>): Promise<string | boolean | number | object> {
 *     return config.features[key]?.variant ?? 'default';
 *   }
 * }
 *
 * Container.register(CustomFeatureManager, { scope: 'singleton' });
 *
 * // Use in services
 * @Service()
 * class UserService {
 *   constructor(private readonly features: FeatureManager) {}
 *
 *   async createProfile(dto: CreateProfileDto) {
 *     if (await this.features.isEnabled('new-profile-flow', { userId: dto.userId })) {
 *       return this.createNewProfile(dto);
 *     }
 *     return this.createLegacyProfile(dto);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Multivariate flag usage
 * @Service()
 * class RecommendationService {
 *   constructor(private readonly features: FeatureManager) {}
 *
 *   async getRecommendations(userId: string) {
 *     const algorithm = await this.features.getVariant('recommendation-alg', { userId });
 *
 *     switch (algorithm) {
 *       case 'collaborative-filtering':
 *         return this.collaborativeFiltering(userId);
 *       case 'content-based':
 *         return this.contentBased(userId);
 *       default:
 *         return this.defaultAlgorithm(userId);
 *     }
 *   }
 * }
 * ```
 */
export { FeatureManager } from "./libs/FeatureManager";
