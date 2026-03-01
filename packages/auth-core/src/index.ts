/**
 * Creates cryptographically secure API keys.
 */
export { ApiKeyGenerator } from './libs/apikey/ApiKeyGenerator';

/**
 * Hashes and verifies API keys.
 */
export { ApiKeyHasher } from './libs/apikey/ApiKeyHasher';

/**
 * Manages API key lifecycle operations.
 */
export { ApiKeyManager } from './libs/apikey/ApiKeyManager';

/**
 * Defines storage operations for API keys.
 */
export type { ApiKeyStore } from './libs/apikey/ApiKeyStore';

/**
 * Metadata keys used by auth decorators and guards.
 */
export { API_KEY_REQUIRED_KEY, AUTH_PERMISSIONS_KEY, AUTH_PUBLIC_KEY } from './libs/constants';

/**
 * Injects the current API key into a handler parameter.
 */
export { CurrentApiKey } from './libs/decorators/CurrentApiKey';

/**
 * Injects the current authenticated principal into a handler parameter.
 */
export { CurrentPrincipal } from './libs/decorators/CurrentPrincipal';

/**
 * Marks an endpoint as publicly accessible.
 */
export { Public } from './libs/decorators/Public';

/**
 * Marks an endpoint as requiring API key authentication.
 */
export { RequireApiKey } from './libs/decorators/RequireApiKey';

/**
 * Declares required permissions for an endpoint.
 */
export { RequirePermission } from './libs/decorators/RequirePermission';

/**
 * Injects the current authenticated user into a handler parameter.
 */
export { User } from './libs/decorators/User';

/**
 * Guard for API key based authentication.
 */
export { ApiKeyGuard } from './libs/guards/ApiKeyGuard';

/**
 * Guard for user authentication and authorization.
 */
export { AuthGuard } from './libs/guards/AuthGuard';

/**
 * Guard for permission-based authorization checks.
 */
export { PermissionGuard } from './libs/guards/PermissionGuard';

/**
 * Unified guard supporting principal and API key flows.
 */
export { UnifiedAuthGuard } from './libs/guards/UnifiedAuthGuard';

/**
 * API key domain model and creation option types.
 */
export type { ApiKey, ApiKeyRateLimit, CreateApiKeyOptions, CreateApiKeyResult } from './libs/interfaces/ApiKey';

/**
 * Contract for resolving API keys to principals.
 */
export type { ApiKeyProvider } from './libs/interfaces/ApiKeyProvider';
/**
 * Contract for resolving authenticated user identities.
 */
export type { AuthProvider } from './libs/interfaces/AuthProvider';
/**
 * Request contract enriched by auth guards.
 */
export type { AuthRequest } from './libs/interfaces/AuthRequest';

/**
 * Authenticated user shape used by auth flows.
 */
export type { AuthUser } from './libs/interfaces/AuthUser';

/**
 * Principal types used by guards and authorization.
 */
export type { ApiKeyPrincipal, Principal, PrincipalType, UserPrincipal } from './libs/interfaces/Principal';

/**
 * Contract for mapping identities to tenant information.
 */
export type { TenantMappingProvider } from './libs/interfaces/TenantMapping';

/**
 * Authentication-related Problem subclasses.
 */
export {
  ApiKeyExpiredProblem,
  ApiKeyRevokedProblem,
  ForbiddenProblem,
  InvalidPermissionActionProblem,
  InvalidPermissionFormatProblem,
  UnauthorizedProblem,
} from './libs/problems/AuthProblems';

/**
 * Permission utilities and permission type.
 */
export { formatPermission, hasPermission, type Permission, parsePermission } from './libs/rbac/Permission';

/**
 * Role-based access control engine.
 */
export { RbacEngine } from './libs/rbac/RbacEngine';

/**
 * Role registry and role definition type.
 */
export {
  type RoleDefinition,
  RoleRegistry,
} from './libs/rbac/Role';

/**
 * Additional auth-core public types.
 */
export * from './libs/types';
