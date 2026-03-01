import { describe, expect, it } from 'vitest';
import type { JwtRequest } from '../libs/resolvers/JwtTenantResolver';
import { JwtTenantResolver } from '../libs/resolvers/JwtTenantResolver';

type RequestWithClaims = JwtRequest & {
  claims?: Record<string, unknown>;
};

describe('JwtTenantResolver', () => {
  it('should resolve tenant from verified claims resolver', async () => {
    const resolver = new JwtTenantResolver<RequestWithClaims>({
      resolveVerifiedClaims: (request) => request.claims ?? null,
    });

    await expect(resolver.resolve({ claims: { tenant_id: 'tenant-123' } })).resolves.toBe('tenant-123');
  });

  it('should support custom claim key', async () => {
    const resolver = new JwtTenantResolver<RequestWithClaims>({
      claimKey: 'org',
      resolveVerifiedClaims: (request) => request.claims ?? null,
    });

    await expect(resolver.resolve({ claims: { org: 'org_abc-123' } })).resolves.toBe('org_abc-123');
  });

  it('should return null when verified claims resolver is not configured', async () => {
    const resolver = new JwtTenantResolver();

    await expect(resolver.resolve({ headers: { authorization: 'Bearer any.token.value' } })).resolves.toBeNull();
  });

  it('should return null for malformed claims payload', async () => {
    const resolver = new JwtTenantResolver<RequestWithClaims>({
      resolveVerifiedClaims: () => 'invalid' as unknown as Record<string, unknown>,
    });

    await expect(resolver.resolve({})).resolves.toBeNull();
  });

  it('should return null when tenant claim is missing', async () => {
    const resolver = new JwtTenantResolver<RequestWithClaims>({
      resolveVerifiedClaims: () => ({ sub: 'user-1' }),
    });

    await expect(resolver.resolve({})).resolves.toBeNull();
  });
});
