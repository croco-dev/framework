/**
 * @packageDocumentation
 *
 * Health check monitoring system for Croco applications.
 *
 * This package provides a flexible health check framework for monitoring application health,
 * including database connectivity checks and extensible health indicators.
 *
 * @example
 * ```typescript
 * import { HealthCheckService, DrizzleHealthIndicator } from '@croco/health-core';
 *
 * // Create health check service
 * const healthService = new HealthCheckService({ timeout: 5000 });
 *
 * // Register indicators
 * healthService.register(new DrizzleHealthIndicator(db, { name: 'postgres' }));
 *
 * // Check health
 * const result = await healthService.check();
 * console.log(result.status); // 'up' | 'down'
 * console.log(result.results); // Array of individual check results
 * ```
 */

/**
 * Options for configuring Drizzle database health indicator.
 *
 * @example
 * ```typescript
 * const options: DrizzleHealthIndicatorOptions = {
 *   name: 'postgres',
 * };
 * ```
 */
export type { DrizzleHealthIndicatorOptions } from './libs/DrizzleHealthIndicator';

/**
 * Health indicator for Drizzle ORM database connections.
 *
 * Performs a simple query (`SELECT 1`) within a transaction to verify database connectivity.
 * Returns 'up' if the query succeeds, 'down' with error details if it fails.
 *
 * @example
 * ```typescript
 * import { DrizzleHealthIndicator } from '@croco/health-core';
 *
 * const indicator = new DrizzleHealthIndicator(db, { name: 'primary-db' });
 * const result = await indicator.check();
 *
 * if (result.status === 'up') {
 *   console.log(`${result.name} is healthy`);
 * } else {
 *   console.error(`${result.name} is down:`, result.details?.error);
 * }
 * ```
 */
export { DrizzleHealthIndicator } from './libs/DrizzleHealthIndicator';
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
 * @property timeout - Maximum time in milliseconds to wait for each health check. Defaults to 5000ms.
 *
 * @example
 * ```typescript
 * const options: HealthCheckServiceOptions = {
 *   timeout: 10000, // 10 seconds
 * };
 * ```
 */
export type { HealthCheckResult, HealthCheckServiceOptions } from './libs/HealthCheckService';

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
 * service.register(new DrizzleHealthIndicator(db));
 * service.register(new RedisHealthIndicator(redis));
 *
 * const result = await service.check();
 * // Returns overall status and detailed results from each indicator
 * ```
 */
export { HealthCheckService } from './libs/HealthCheckService';
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
 * @property details - Optional additional information, typically containing error messages when status is 'down'
 *
 * @example
 * ```typescript
 * const result: HealthIndicatorResult = {
 *   name: 'database',
 *   status: 'down',
 *   details: { error: 'Connection refused' },
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
 * const status: HealthStatus = 'up'; // Component is healthy
 * ```
 */
export type { HealthIndicator, HealthIndicatorResult, HealthStatus } from './libs/HealthIndicator';
