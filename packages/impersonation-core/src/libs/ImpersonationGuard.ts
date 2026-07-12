import "reflect-metadata";
import type { AuthRequest, RouteExecutionContext } from "@croco/auth-core";
import { ForbiddenProblem, hasPermission, UnauthorizedProblem } from "@croco/auth-core";
import { Component, type Guard } from "@croco/framework-context";

@Component()
export class ImpersonationGuard implements Guard<RouteExecutionContext> {
  canActivate(context: RouteExecutionContext): boolean {
    const request = context.getRequest() as AuthRequest;
    const principal = request.principal ?? request.user;
    if (!principal) throw new UnauthorizedProblem();
    if (!hasPermission(principal.permissions, "impersonation:manage")) {
      throw new ForbiddenProblem("impersonation:manage");
    }
    return true;
  }
}
