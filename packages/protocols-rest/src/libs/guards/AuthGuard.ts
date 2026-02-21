import type { ExecutionContext } from '../interfaces/ExecutionContext';
import type { Guard } from '../interfaces/Guard';
import type { HttpRequestLike } from '../types';

export type TokenVerifier = (token: string) => Promise<unknown> | unknown;

export type AuthGuardOptions = {
  verifier: TokenVerifier;
  headerName?: string;
  scheme?: string;
};

class AuthGuardProblem extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
    this.name = 'AuthGuardProblem';

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      type: 'about:blank',
      title: this.status === 400 ? 'Bad Request' : 'Unauthorized',
      status: this.status,
      code: this.code,
      detail: this.message,
    };
  }
}

function unauthorized(code: string, detail: string): AuthGuardProblem {
  return new AuthGuardProblem(401, code, detail);
}

function badRequest(code: string, detail: string): AuthGuardProblem {
  return new AuthGuardProblem(400, code, detail);
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

      if (user) {
        typedRequest.user = user;
      }

      return true;
    } catch {
      throw unauthorized('AUTH_INVALID_TOKEN', 'Invalid or expired token');
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
