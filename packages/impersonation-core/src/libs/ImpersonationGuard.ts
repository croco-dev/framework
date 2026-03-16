import 'reflect-metadata';
import type { AuthRequest, RouteExecutionContext } from '@croco/auth-core';
import { ForbiddenProblem, UnauthorizedProblem } from '@croco/auth-core';
import { Component, type Guard } from '@croco/framework-context';

function hasPermission(permissions: string[] | undefined, permission: string): boolean {
  return permissions?.includes(permission) ?? false;
}

@Component()
export class ImpersonationGuard implements Guard<RouteExecutionContext> {
  canActivate(context: RouteExecutionContext): boolean {
    const request = context.getRequest() as AuthRequest;
    const principal = request.principal ?? request.user;
    if (!principal) throw new UnauthorizedProblem();
    if (!hasPermission(principal.permissions, 'impersonation:manage')) {
      throw new ForbiddenProblem('impersonation:manage');
    }
    return true;
  }
}
