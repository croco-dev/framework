import type { Guard } from '@croco/framework-context';
import { Problem, ProblemCategory } from '@croco/problems-core';
import type { ExecutionContext } from '../interfaces/ExecutionContext';
import type { HttpRequestLike } from '../types';

export type TokenVerifier = (token: string) => Promise<unknown> | unknown;

export type AuthGuardOptions = {
  verifier: TokenVerifier;
  headerName?: string;
  scheme?: string;
};

class AuthGuardProblem extends Problem {
  constructor(status: number, code: string, detail: string) {
    const category =
      status === 400
        ? ProblemCategory.BadRequest
        : status === 500
          ? ProblemCategory.InternalServerError
          : ProblemCategory.Unauthorized;

    super(code, category, detail);
  }
}

function unauthorized(code: string, detail: string): AuthGuardProblem {
  return new AuthGuardProblem(401, code, detail);
}

function badRequest(code: string, detail: string): AuthGuardProblem {
  return new AuthGuardProblem(400, code, detail);
}

function verifierUnavailable(detail: string): AuthGuardProblem {
  return new AuthGuardProblem(500, 'AUTH_VERIFIER_UNAVAILABLE', detail);
}

function isTokenVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name.toUpperCase();
  const message = error.message.toLowerCase();

  return (
    name.startsWith('ERR_JWT_') ||
    name.startsWith('ERR_JWS_') ||
    name.startsWith('ERR_JWE_') ||
    message.includes('token expired') ||
    message.includes('invalid token') ||
    message.includes('jwt expired') ||
    message.includes('token invalid')
  );
}

export class AuthGuard implements Guard<ExecutionContext> {
  private readonly verifier: TokenVerifier;
  private readonly headerName: string;
  private readonly scheme: string;

  constructor(options: AuthGuardOptions) {
    this.verifier = options.verifier;
    this.headerName = options.headerName ?? 'authorization';
    this.scheme = options.scheme ?? 'Bearer';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.getRequest();

    // 타입 가드로 HttpRequestLike 최소 속성 검증
    if (typeof request !== 'object' || request === null || !('headers' in request)) {
      throw badRequest('AUTH_INVALID_REQUEST', 'Invalid request object');
    }

    const typedRequest = request as HttpRequestLike & { user?: unknown };
    const authHeader = this.getHeaderValue(typedRequest.headers, this.headerName);

    if (!authHeader) {
      throw unauthorized('AUTH_MISSING_HEADER', 'Missing authorization header');
    }

    const token = this.extractToken(authHeader);
    if (!token) {
      throw badRequest('AUTH_INVALID_HEADER_FORMAT', 'Invalid authorization header format');
    }

    try {
      const user = await this.verifier(token);

      if (!user) {
        throw unauthorized('AUTH_INVALID_TOKEN', 'Invalid or expired token');
      }

      typedRequest.user = user;

      return true;
    } catch (error) {
      if (error instanceof Problem && error.code === 'AUTH_INVALID_TOKEN') {
        throw error;
      }

      if (isTokenVerificationError(error)) {
        throw unauthorized('AUTH_INVALID_TOKEN', 'Invalid or expired token');
      }

      throw verifierUnavailable('Authentication verifier is unavailable');
    }
  }

  private extractToken(header: string): string | null {
    const parts = header.split(' ');
    if (parts.length !== 2) {
      return null;
    }

    const [scheme, token] = parts;
    if (scheme.toLowerCase() !== this.scheme.toLowerCase()) {
      return null;
    }

    if (!token) {
      return null;
    }

    return token;
  }

  private getHeaderValue(headers: unknown, headerName: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(headerName) ?? undefined;
    }

    if (typeof headers !== 'object' || headers === null) {
      return undefined;
    }

    const headerRecord = headers as Record<string, unknown>;
    const direct = headerRecord[headerName];

    if (typeof direct === 'string') {
      return direct;
    }

    const normalizedHeaderName = headerName.toLowerCase();

    for (const [key, value] of Object.entries(headerRecord)) {
      if (key.toLowerCase() === normalizedHeaderName && typeof value === 'string') {
        return value;
      }
    }

    return undefined;
  }
}
