/**
 * @packageDocumentation
 *
 * Health check monitoring system for Croco applications.
 *
 * This package provides a flexible health check framework for monitoring application health,
 * with extensible health indicators.
 *
 * @example
 * ```typescript
 * import type { HealthIndicator } from '@croco/health-core';
 * import { HealthCheckService } from '@croco/health-core';
 *
 * const healthService = new HealthCheckService({ timeout: 5000 });
 *
 * class ApiHealthIndicator implements HealthIndicator {
 *   async check() {
 *     return { name: 'api', status: 'up' as const };
 *   }
 * }
 *
 * healthService.register(new ApiHealthIndicator());
 *
 * // Check health
 * const result = await healthService.check();
 * ```
 */

/**
 * Result of a health check operation.
 *
 * Contains the overall health status and individual results from all registered indicators.
 *
 * @example
 * ```typescript
 * const result: HealthCheckResult = {
 *   status: 'up',
 *   results: [
 *     { name: 'database', status: 'up' },
 *     { name: 'redis', status: 'up' },
 *   ],
 * };
 * ```
 */
/**
 * Configuration options for the health check service.
 *
 * @property timeout - Integer milliseconds from 1 through 2_147_483_647. Defaults to 5000ms. Invalid values throw InvalidHealthCheckTimeoutProblem during service setup or indicator registration.
 *
 * @example
 * ```typescript
 * const options: HealthCheckServiceOptions = {
 *   timeout: 10000, // 10 seconds
 * };
 * ```
 */
export type { HealthCheckResult, HealthCheckServiceOptions } from "./libs/HealthCheckService";

/**
 * Service for orchestrating health checks across multiple indicators.
 *
 * Manages a collection of health indicators and executes their checks in parallel with a configurable timeout.
 * The overall health status is 'up' only if all indicators report 'up'.
 *
 * @example
 * ```typescript
 * import { HealthCheckService } from '@croco/health-core';
 *
 * const service = new HealthCheckService({ timeout: 5000 });
 * service.register(new RedisHealthIndicator(redis));
 * service.register(new ApiHealthIndicator());
 *
 * const result = await service.check();
 * // Returns overall status and detailed results from each indicator
 * ```
 */
export { HealthCheckService } from "./libs/HealthCheckService";
export {
  InvalidHealthCheckTimeoutProblem,
  MAX_HEALTH_CHECK_TIMEOUT_MS,
} from "./libs/problems/HealthProblems";
/**
 * Interface for health check indicators.
 *
 * Implement this interface to create custom health checks for any dependency or service.
 *
 * @example
 * ```typescript
 * class RedisHealthIndicator implements HealthIndicator {
 *   constructor(private readonly redis: RedisClient) {}
 *
 *   async check(): Promise<HealthIndicatorResult> {
 *     try {
 *       await this.redis.ping();
 *       return { name: 'redis', status: 'up' };
 *     } catch (error) {
 *       return {
 *         name: 'redis',
 *         status: 'down',
 *         details: { error: String(error) },
 *       };
 *     }
 *   }
 * }
 * ```
 */
/**
 * Result returned by an individual health check indicator.
 *
 * Contains the indicator name, its health status, and optional error details.
 *
 * @property name - Identifier for the health check (e.g., 'database', 'redis')
 * @property status - Current health status: 'up' (healthy) or 'down' (unhealthy)
 * @property details - Optional additional information, typically containing error messages when status is 'down' or metrics when status is 'up'
 *
 * @example
 * ```typescript
 * const errorResult: HealthIndicatorResult = {
 *   name: 'database',
 *   status: 'down',
 *   details: { error: 'Connection refused', code: 'ECONNREFUSED' },
 * };
 *
 * const successResult: HealthIndicatorResult = {
 *   name: 'redis',
 *   status: 'up',
 *   details: { latency: 5, connections: 10 },
 * };
 * ```
 */
/**
 * Health status of a system or component.
 *
 * @type {'up' | 'down'}
 *
 * - `'up'` - The component is functioning normally
 * - `'down'` - The component is unhealthy or unreachable
 *
 * @example
 * ```typescript
 * const status: HealthStatus = 'up';
 * ```
 */
/**
 * Error details for a failed health check.
 *
 * @property error - Error message describing what went wrong
 * @property message - Optional additional error context
 * @property code - Optional error code for categorization
 *
 * @example
 * ```typescript
 * const errorDetails: HealthIndicatorErrorDetails = {
 *   error: 'Connection timeout',
 *   message: 'Database did not respond within 5000ms',
 *   code: 'ETIMEDOUT',
 * };
 * ```
 */
/**
 * Success details for a passing health check.
 *
 * Can include metrics, latency information, or other diagnostic data.
 *
 * @example
 * ```typescript
 * const successDetails: HealthIndicatorSuccessDetails = {
 *   latency: 15,
 *   connections: 5,
 *   version: '1.2.3',
 * };
 * ```
 */
export type {
  HealthIndicator,
  HealthIndicatorErrorDetails,
  HealthIndicatorResult,
  HealthIndicatorSuccessDetails,
  HealthStatus,
  ReadinessIndicator,
} from "./libs/HealthIndicator";
export type { HealthCheckTimeoutSource } from "./libs/problems/HealthProblems";
