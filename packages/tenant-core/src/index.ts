export { DuplicateTenantManagerRegistrationProblem } from './libs/problems/DuplicateTenantManagerRegistrationProblem';
/**
 * Thrown when a tenant manager has not been registered.
 */
export { TenantManagerNotRegisteredProblem } from './libs/problems/TenantManagerNotRegisteredProblem';

/**
 * Thrown when a requested tenant cannot be found.
 */
export { TenantNotFoundProblem } from './libs/problems/TenantNotFoundProblem';

/**
 * Thrown when tenant context is required but missing.
 */
export { TenantRequiredProblem } from './libs/problems/TenantRequiredProblem';

/**
 * Resolves tenant identifiers from JWT payloads.
 */
export { JwtTenantResolver } from './libs/resolvers/JwtTenantResolver';

/**
 * Manages tenant context across async boundaries.
 */
export { TenantManager } from './libs/TenantManager';

/**
 * Registry for locating tenant manager instances.
 */
export { TenantManagerRegistry } from './libs/TenantManagerRegistry';

/**
 * Contract for resolving tenant identifiers.
 */
export type { TenantResolver } from './libs/TenantResolver';

/**
 * Tenant context stored for the current request scope.
 */
export type { TenantContext } from './libs/types';
