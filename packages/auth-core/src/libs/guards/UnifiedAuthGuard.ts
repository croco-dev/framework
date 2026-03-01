import 'reflect-metadata';
import { AUTH_PUBLIC_KEY } from '../constants';
import type { ApiKeyProvider } from '../interfaces/ApiKeyProvider';
import type { AuthProvider } from '../interfaces/AuthProvider';
import type { Guard, RouteExecutionContext } from '../interfaces/Guard';
import { UnauthorizedProblem } from '../problems/AuthProblems';
import { getHeaderValue } from './headerUtils';

function isPublicRoute(controllerTarget: object, handler: string | symbol): boolean {
  const classTarget = typeof controllerTarget === 'function' ? controllerTarget : controllerTarget.constructor;
  const prototypeTarget = typeof controllerTarget === 'function' ? controllerTarget.prototype : controllerTarget;

  return Boolean(
    Reflect.getMetadata(AUTH_PUBLIC_KEY, classTarget, handler) ??
      Reflect.getMetadata(AUTH_PUBLIC_KEY, prototypeTarget, handler) ??
      Reflect.getMetadata(AUTH_PUBLIC_KEY, classTarget)
  );
}

function isMetadataTarget(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export class UnifiedAuthGuard implements Guard<RouteExecutionContext> {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly apiKeyProvider: ApiKeyProvider
  ) {}

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

    const request = context.getRequest();
    const apiKeyHeader = getHeaderValue(request, 'x-api-key');

    if (apiKeyHeader) {
      const principal = await this.apiKeyProvider.authenticate(request);
      if (principal) {
        request.principal = principal;
        request.apiKey = principal;
        return true;
      }
      throw new UnauthorizedProblem('Invalid API key');
    }

    const user = await this.authProvider.authenticate(request);
    if (user) {
      request.principal = { ...user, type: 'user' as const };
      request.user = user;
      return true;
    }

    throw new UnauthorizedProblem();
  }
}
