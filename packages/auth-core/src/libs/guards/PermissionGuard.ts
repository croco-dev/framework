import 'reflect-metadata';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import { AUTH_PERMISSIONS_KEY } from '../constants';
import type { AuthUser } from '../interfaces/AuthUser';
import { ForbiddenProblem } from '../problems/AuthProblems';
import type { RbacEngine } from '../rbac/RbacEngine';

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
    const user = (context.getRequest() as any).user as AuthUser | undefined;

    if (!user) {
      return false;
    }

    for (const permission of requiredPermissions) {
      if (!this.rbacEngine.hasPermission(user, permission)) {
        throw new ForbiddenProblem(`Missing permission: ${permission}`);
      }
    }

    return true;
  }
}
