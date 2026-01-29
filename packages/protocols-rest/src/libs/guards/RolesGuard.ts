import 'reflect-metadata';
import { REST_ROLES_KEY } from '../constants';
import type { ExecutionContext } from '../interfaces/ExecutionContext';
import type { Guard } from '../interfaces/Guard';

export type UserWithRoles = {
  roles?: string[];
};

export class RolesGuard implements Guard<ExecutionContext> {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const target = context.getClass();

    const requiredRoles = Reflect.getMetadata(REST_ROLES_KEY, target, handler) as string[] | undefined;

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.getRequest() as { user?: UserWithRoles };
    const userRoles = request.user?.roles ?? [];

    return requiredRoles.some((role) => userRoles.includes(role));
  }
}
