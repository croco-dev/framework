import "reflect-metadata";
import { AUTH_PUBLIC_KEY } from "../constants";
import type { ApiKeyProvider } from "../interfaces/ApiKeyProvider";
import type { AuthProvider } from "../interfaces/AuthProvider";
import type { AuthRequest } from "../interfaces/AuthRequest";
import type { Guard, RouteExecutionContext } from "../interfaces/Guard";
import { UnauthorizedProblem } from "../problems/AuthProblems";
import { authenticateWithProvider } from "./authenticateWithProvider";
import { getHeaderValue } from "./headerUtils";
import { isApiKeyRequiredRoute } from "./isApiKeyRequiredRoute";
import { requireRouteMetadataTarget } from "./requireRouteMetadataTarget";

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

export class UnifiedAuthGuard implements Guard<RouteExecutionContext> {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly apiKeyProvider: ApiKeyProvider,
  ) {}

  async canActivate(context: RouteExecutionContext): Promise<boolean> {
    const target = requireRouteMetadataTarget(context.getClass());
    const handler = context.getHandler();

    const isPublic = isPublicRoute(target, handler);
    const isApiKeyRequired = isApiKeyRequiredRoute(target, handler);

    if (isPublic && !isApiKeyRequired) {
      return true;
    }

    const request = context.getRequest() as AuthRequest;
    const apiKeyHeader = getHeaderValue(request, "x-api-key");

    if (apiKeyHeader) {
      const principal = await authenticateWithProvider(this.apiKeyProvider, request);
      if (principal) {
        request.principal = principal;
        request.apiKey = principal;
        return true;
      }
      throw new UnauthorizedProblem("Invalid API key");
    }

    if (isApiKeyRequired) {
      throw new UnauthorizedProblem("Missing API key");
    }

    const user = await authenticateWithProvider(this.authProvider, request);
    if (user) {
      request.principal = { ...user, type: "user" as const };
      request.user = user;
      return true;
    }

    throw new UnauthorizedProblem();
  }
}
