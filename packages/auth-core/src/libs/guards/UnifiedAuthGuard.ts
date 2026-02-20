import 'reflect-metadata';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import { AUTH_PUBLIC_KEY } from '../constants';
import type { ApiKeyProvider } from '../interfaces/ApiKeyProvider';
import type { AuthProvider } from '../interfaces/AuthProvider';
import { UnauthorizedProblem } from '../problems/AuthProblems';
import { getHeaderValue } from './headerUtils';

export class UnifiedAuthGuard implements Guard<ExecutionContext> {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly apiKeyProvider: ApiKeyProvider
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    const isPublic =
      Reflect.getMetadata(AUTH_PUBLIC_KEY, target, handler) || Reflect.getMetadata(AUTH_PUBLIC_KEY, target.constructor);

    if (isPublic) {
      return true;
    }

    const request = context.getRequest();
    const apiKeyHeader = getHeaderValue(request, 'x-api-key');

    if (apiKeyHeader) {
      const principal = await this.apiKeyProvider.authenticate(request);
      if (principal) {
        const requestRecord = request as unknown as Record<string, unknown>;
        requestRecord.principal = principal;
        requestRecord.apiKey = principal;
        return true;
      }
      throw new UnauthorizedProblem('Invalid API key');
    }

    const user = await this.authProvider.authenticate(request);
    if (user) {
      const requestRecord = request as unknown as Record<string, unknown>;
      requestRecord.principal = { ...user, type: 'user' as const };
      requestRecord.user = user;
      return true;
    }

    throw new UnauthorizedProblem();
  }
}
