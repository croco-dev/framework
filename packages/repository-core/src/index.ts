/**
 * Abstract base repository for Drizzle-based implementations with transaction-aware DB access.
 */
export * from './libs/AbstractDrizzleRepository';

/**
 * Read-only repository contract for fetching entities by single or multiple IDs.
 */
export * from './libs/ReadRepository';

/**
 * Unified repository contract that combines read and write capabilities.
 */
export * from './libs/Repository';

/**
 * Write-only repository contract for saving and deleting entities.
 */
export * from './libs/WriteRepository';
