import 'reflect-metadata';
import type { Guard } from '@croco/framework-context';
import type { ApiKeyProvider } from '../interfaces/ApiKeyProvider';
import type { RouteExecutionContext } from '../interfaces/RouteExecutionContext';
import { UnauthorizedProblem } from '../problems/AuthProblems';
import { getHeaderValue } from './headerUtils';

export class ApiKeyGuard implements Guard<RouteExecutionContext> {
  constructor(private readonly apiKeyProvider: ApiKeyProvider) {}

  async canActivate(context: RouteExecutionContext): Promise<boolean> {
    const request = context.getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedProblem('Missing API key');
    }

    const principal = await this.apiKeyProvider.authenticate(request);

    if (!principal) {
      throw new UnauthorizedProblem('Invalid API key');
    }

    request.principal = principal;
    request.apiKey = principal;

    return true;
  }

  private extractApiKey(request: Request): string | null {
    return getHeaderValue(request, 'x-api-key');
  }
}
