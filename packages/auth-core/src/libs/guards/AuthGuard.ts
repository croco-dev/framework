import 'reflect-metadata';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import { AUTH_PUBLIC_KEY } from '../constants';
import type { AuthProvider } from '../interfaces/AuthProvider';
import { UnauthorizedProblem } from '../problems/AuthProblems';

export class AuthGuard implements Guard<ExecutionContext> {
  constructor(private authProvider: AuthProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    const isPublic =
      Reflect.getMetadata(AUTH_PUBLIC_KEY, target, handler) || Reflect.getMetadata(AUTH_PUBLIC_KEY, target.constructor);

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
