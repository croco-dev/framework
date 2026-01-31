import type { TenantResolver } from '../TenantResolver';

type JwtRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

type JwtPayload = Record<string, unknown>;

/**
 * Resolves tenant ID from JWT token's payload claims.
 * Expects the JWT to be passed in the Authorization header as Bearer token.
 */
export class JwtTenantResolver implements TenantResolver<JwtRequest> {
  constructor(private readonly claimKey: string = 'tenant_id') {}

  async resolve(request: JwtRequest): Promise<string | null> {
    const authHeader = this.getHeader(request.headers, 'authorization');
    if (!authHeader) {
      return null;
    }

    const token = this.extractBearerToken(authHeader);
    if (!token) {
      return null;
    }

    const payload = this.decodeJwtPayload(token);
    if (!payload) {
      return null;
    }

    const tenantId = payload[this.claimKey];
    if (typeof tenantId !== 'string') {
      return null;
    }

    return tenantId;
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined> | undefined,
    key: string
  ): string | undefined {
    if (!headers) return undefined;
    const value = headers[key] ?? headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private extractBearerToken(authHeader: string): string | null {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  private decodeJwtPayload(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payloadBase64 = parts[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      return JSON.parse(payloadJson) as JwtPayload;
    } catch {
      return null;
    }
  }
}
