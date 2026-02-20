import { describe, expect, it } from 'vitest';
import { JwtTenantResolver } from '../libs/resolvers/JwtTenantResolver';

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('JwtTenantResolver', () => {
  it('should resolve tenant from mixed-case Authorization header', async () => {
    const resolver = new JwtTenantResolver();
    const token = createJwt({ tenant_id: 'tenant-123' });

    await expect(
      resolver.resolve({
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    ).resolves.toBe('tenant-123');
  });

  it('should decode base64url payload correctly', async () => {
    const resolver = new JwtTenantResolver('org');
    const token = createJwt({ org: 'org_abc-123' });

    await expect(
      resolver.resolve({
        headers: {
          authorization: `Bearer ${token}`,
        },
      })
    ).resolves.toBe('org_abc-123');
  });

  it('should return null for malformed bearer token', async () => {
    const resolver = new JwtTenantResolver();

    await expect(
      resolver.resolve({
        headers: {
          authorization: 'Bearer malformed.token',
        },
      })
    ).resolves.toBeNull();
  });
});
