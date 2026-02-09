import 'reflect-metadata';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import { AUTH_PERMISSIONS_KEY } from '../constants';
import type { ApiKeyPrincipal, Principal, UserPrincipal } from '../interfaces/Principal';
import { ForbiddenProblem } from '../problems/AuthProblems';
import { hasPermission } from '../rbac/Permission';
import type { RbacEngine } from '../rbac/RbacEngine';

type PrincipalWithRoles =
  | UserPrincipal
  | { id: string; email?: string; roles: string[]; permissions: string[]; metadata?: Record<string, unknown> };

export class PermissionGuard implements Guard<ExecutionContext> {
  constructor(private rbacEngine: RbacEngine) {}

  canActivate(context: ExecutionContext): boolean {
    const target = context.getClass();
    const handler = context.getHandler();

    const requiredPermissions = Reflect.getMetadata(AUTH_PERMISSIONS_KEY, target, handler) as string[] | undefined;

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = context.getRequest() as any;
    const principal = request.principal as Principal | undefined;
    const user = request.user; // 하위 호환성

    const authenticatedPrincipal = principal || user;

    if (!authenticatedPrincipal) {
      return false;
    }

    // ApiKeyPrincipal: roles가 없으므로 permissions 직접 체크
    if (authenticatedPrincipal.type === 'apikey') {
      const apiKeyPrincipal = authenticatedPrincipal as ApiKeyPrincipal;
      for (const permission of requiredPermissions) {
        if (!hasPermission(apiKeyPrincipal.permissions, permission)) {
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
