import 'reflect-metadata';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import { AUTH_PUBLIC_KEY } from '../constants';
import type { AuthProvider } from '../interfaces/AuthProvider';
import { UnauthorizedProblem } from '../problems/AuthProblems';

function isPublicRoute(controllerTarget: object, handler: string | symbol): boolean {
  const classTarget = typeof controllerTarget === 'function' ? controllerTarget : controllerTarget.constructor;
  const prototypeTarget = typeof controllerTarget === 'function' ? controllerTarget.prototype : controllerTarget;

  return Boolean(
    Reflect.getMetadata(AUTH_PUBLIC_KEY, classTarget, handler) ??
      Reflect.getMetadata(AUTH_PUBLIC_KEY, prototypeTarget, handler) ??
      Reflect.getMetadata(AUTH_PUBLIC_KEY, classTarget)
  );
}

export class AuthGuard implements Guard<ExecutionContext> {
  constructor(private authProvider: AuthProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    const isPublic = isPublicRoute(target, handler);

    if (isPublic) {
      return true;
    }

    const request = context.getRequest();
    const user = await this.authProvider.authenticate(request);

    if (!user) {
      throw new UnauthorizedProblem();
    }

    (request as unknown as Record<string, unknown>).user = user;
    return true;
  }
}
