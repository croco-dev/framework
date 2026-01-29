import type { ExecutionContext } from '../interfaces/ExecutionContext';
import type { Guard } from '../interfaces/Guard';
import type { HttpRequestLike } from '../types';

export type TokenVerifier = (token: string) => Promise<unknown> | unknown;

export type AuthGuardOptions = {
  verifier: TokenVerifier;
  headerName?: string;
  scheme?: string;
};

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
    const request = context.getRequest() as unknown as HttpRequestLike & { user?: unknown };
    const authHeader = request.headers[this.headerName];

    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = this.extractToken(authHeader);
    if (!token) {
      throw new Error('Invalid authorization header format');
    }

    try {
      const user = await this.verifier(token);

      if (user) {
        request.user = user;
      }

      return true;
    } catch {
      throw new Error('Invalid or expired token');
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

    return token;
  }
}
