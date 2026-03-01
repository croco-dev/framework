import 'reflect-metadata';
import { AUTH_PERMISSIONS_KEY } from '../constants';
import type { AuthUser } from '../interfaces/AuthUser';
import type { Guard, RouteExecutionContext } from '../interfaces/Guard';
import type { UserPrincipal } from '../interfaces/Principal';
import { ForbiddenProblem } from '../problems/AuthProblems';
import { hasPermission } from '../rbac/Permission';
import type { RbacEngine } from '../rbac/RbacEngine';

type PrincipalWithRoles = UserPrincipal | AuthUser;

function isMetadataTarget(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export class PermissionGuard implements Guard<RouteExecutionContext> {
  constructor(private rbacEngine: RbacEngine) {}

  canActivate(context: RouteExecutionContext): boolean {
    const target = context.getClass();
    const handler = context.getHandler();

    if (!isMetadataTarget(target)) {
      return true;
    }

    const requiredPermissions = Reflect.getMetadata(AUTH_PERMISSIONS_KEY, target, handler) as string[] | undefined;

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.getRequest();
    const principal = request.principal;
    const user = request.user;

    const authenticatedPrincipal = principal || user;

    if (!authenticatedPrincipal) {
      return false;
    }

    // ApiKeyPrincipal: roles가 없으므로 permissions 직접 체크
    if ('type' in authenticatedPrincipal && authenticatedPrincipal.type === 'apikey') {
      for (const permission of requiredPermissions) {
        if (!hasPermission(authenticatedPrincipal.permissions, permission)) {
          throw new ForbiddenProblem(`Missing permission: ${permission}`);
        }
      }
      return true;
    }

    // UserPrincipal 또는 AuthUser: roles 기반 권한 체크
    const principalWithRoles = authenticatedPrincipal as PrincipalWithRoles;
    for (const permission of requiredPermissions) {
      if (!this.rbacEngine.hasPermission(principalWithRoles, permission)) {
        throw new ForbiddenProblem(`Missing permission: ${permission}`);
      }
    }

    return true;
  }
}
