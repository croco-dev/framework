import 'reflect-metadata';
import type { ApiKeyProvider } from '../interfaces/ApiKeyProvider';
import type { Guard, RouteExecutionContext } from '../interfaces/Guard';
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

    const requestRecord = request as unknown as Record<string, unknown>;
    requestRecord.principal = principal;
    requestRecord.apiKey = principal;

    return true;
  }

  private extractApiKey(request: Request): string | null {
    return getHeaderValue(request, 'x-api-key');
  }
}
