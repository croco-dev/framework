export { ApiKeyGenerator } from './libs/apikey/ApiKeyGenerator';
export { ApiKeyHasher } from './libs/apikey/ApiKeyHasher';
export { ApiKeyManager } from './libs/apikey/ApiKeyManager';
export type { ApiKeyStore } from './libs/apikey/ApiKeyStore';
export { API_KEY_REQUIRED_KEY, AUTH_PERMISSIONS_KEY, AUTH_PUBLIC_KEY } from './libs/constants';
export { CurrentApiKey } from './libs/decorators/CurrentApiKey';
export { CurrentPrincipal } from './libs/decorators/CurrentPrincipal';
export { Public } from './libs/decorators/Public';
export { RequireApiKey } from './libs/decorators/RequireApiKey';
export { RequirePermission } from './libs/decorators/RequirePermission';
export { User } from './libs/decorators/User';
export { ApiKeyGuard } from './libs/guards/ApiKeyGuard';
export { AuthGuard } from './libs/guards/AuthGuard';
export { PermissionGuard } from './libs/guards/PermissionGuard';
export { UnifiedAuthGuard } from './libs/guards/UnifiedAuthGuard';
export type { ApiKey, ApiKeyRateLimit, CreateApiKeyOptions, CreateApiKeyResult } from './libs/interfaces/ApiKey';
export type { ApiKeyProvider } from './libs/interfaces/ApiKeyProvider';
export type { AuthProvider } from './libs/interfaces/AuthProvider';
export type { AuthUser } from './libs/interfaces/AuthUser';
export type { ApiKeyPrincipal, Principal, PrincipalType, UserPrincipal } from './libs/interfaces/Principal';
export type { TenantMappingProvider } from './libs/interfaces/TenantMapping';
export {
  ApiKeyExpiredProblem,
  ApiKeyRevokedProblem,
  ForbiddenProblem,
  InvalidPermissionActionProblem,
  InvalidPermissionFormatProblem,
  UnauthorizedProblem,
} from './libs/problems/AuthProblems';
export { formatPermission, hasPermission, type Permission, parsePermission } from './libs/rbac/Permission';
export { RbacEngine } from './libs/rbac/RbacEngine';
export {
  type RoleDefinition,
  RoleRegistry,
} from './libs/rbac/Role';

export * from './libs/types';
