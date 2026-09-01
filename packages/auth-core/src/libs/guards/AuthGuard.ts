import "reflect-metadata";
import { Container, Token } from "@croco/framework-context";
import { AUTH_PUBLIC_KEY } from "../constants";
import type { AuthProvider } from "../interfaces/AuthProvider";
import type { AuthRequest } from "../interfaces/AuthRequest";
import type { Guard, RouteExecutionContext } from "../interfaces/Guard";
import { UnauthorizedProblem } from "../problems/AuthProblems";
import { authenticateWithProvider } from "./authenticateWithProvider";
import { isApiKeyRequiredRoute } from "./isApiKeyRequiredRoute";
import { requireRouteMetadataTarget } from "./requireRouteMetadataTarget";

export const AUTH_PROVIDER_TOKEN = new Token<AuthProvider>("AuthProvider");

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

export class AuthGuard implements Guard<RouteExecutionContext> {
  async canActivate(context: RouteExecutionContext): Promise<boolean> {
    const target = requireRouteMetadataTarget(context.getClass());
    const handler = context.getHandler();

    const isPublic = isPublicRoute(target, handler);
    const isApiKeyRequired = isApiKeyRequiredRoute(target, handler);

    if (isPublic && !isApiKeyRequired) {
      return true;
    }

    if (isApiKeyRequired) {
      throw new UnauthorizedProblem("API key required");
    }

    const authProvider = Container.getOptional(AUTH_PROVIDER_TOKEN);

    if (!authProvider) {
      throw new UnauthorizedProblem();
    }

    const request = context.getRequest() as AuthRequest;
    const user = await authenticateWithProvider(authProvider, request);

    if (!user) {
      throw new UnauthorizedProblem();
    }

    request.user = user;
    return true;
  }
}
