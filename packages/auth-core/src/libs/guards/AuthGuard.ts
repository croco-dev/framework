import "reflect-metadata";
import { AUTH_PUBLIC_KEY } from "../constants";
import type { AuthProvider } from "../interfaces/AuthProvider";
import type { AuthRequest } from "../interfaces/AuthRequest";
import type { Guard, RouteExecutionContext } from "../interfaces/Guard";
import { UnauthorizedProblem } from "../problems/AuthProblems";

function isPublicRoute(controllerTarget: object, handler: string | symbol): boolean {
  const classTarget =
    typeof controllerTarget === "function" ? controllerTarget : controllerTarget.constructor;
  const prototypeTarget =
    typeof controllerTarget === "function" ? controllerTarget.prototype : controllerTarget;

  return Boolean(
    Reflect.getMetadata(AUTH_PUBLIC_KEY, classTarget, handler) ??
    Reflect.getMetadata(AUTH_PUBLIC_KEY, prototypeTarget, handler) ??
    Reflect.getMetadata(AUTH_PUBLIC_KEY, classTarget),
  );
}

function isMetadataTarget(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

export class AuthGuard implements Guard<RouteExecutionContext> {
  constructor(private authProvider: AuthProvider) {}

  async canActivate(context: RouteExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    if (!isMetadataTarget(target)) {
      return true;
    }

    const isPublic = isPublicRoute(target, handler);

    if (isPublic) {
      return true;
    }

    const request = context.getRequest() as AuthRequest;
    const user = await this.authProvider.authenticate(request);

    if (!user) {
      throw new UnauthorizedProblem();
    }

    request.user = user;
    return true;
  }
}
