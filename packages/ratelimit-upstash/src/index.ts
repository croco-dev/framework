/**
 * @packageDocumentation
 * Public API for the Upstash-backed rate limit store implementation.
 */

/** Configuration options for the Upstash rate limit store. */
export type { UpstashRateLimitStoreOptions } from './libs/UpstashRateLimitStore';

/** Rate limit store implementation backed by Upstash Ratelimit. */
export { UpstashRateLimitStore } from './libs/UpstashRateLimitStore';
