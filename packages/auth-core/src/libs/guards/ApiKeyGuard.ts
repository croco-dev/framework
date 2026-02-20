import 'reflect-metadata';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import type { ApiKeyProvider } from '../interfaces/ApiKeyProvider';
import { UnauthorizedProblem } from '../problems/AuthProblems';
import { getHeaderValue } from './headerUtils';

export class ApiKeyGuard implements Guard<ExecutionContext> {
  constructor(private readonly apiKeyProvider: ApiKeyProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
