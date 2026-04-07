import { describe, expect, it } from 'vitest';
import { SubdomainTenantResolver } from '../libs/resolvers/SubdomainTenantResolver';

describe('SubdomainTenantResolver', () => {
  it('should resolve tenant from subdomain', async () => {
    const resolver = new SubdomainTenantResolver();
    const result = await resolver.resolve({ url: 'https://acme.example.com/api' });
    expect(result).toBe('acme');
  });

  it('should return null for apex domain', async () => {
    const resolver = new SubdomainTenantResolver();
    const result = await resolver.resolve({ url: 'https://example.com/api' });
    expect(result).toBeNull();
  });

  it('should return null for short domain', async () => {
    const resolver = new SubdomainTenantResolver();
    const result = await resolver.resolve({ url: 'https://localhost:3000/api' });
    expect(result).toBeNull();
  });

  it('should extract subdomain with custom suffix', async () => {
    const resolver = new SubdomainTenantResolver({ domainSuffix: '.myapp.com' });
    const result = await resolver.resolve({ url: 'https://company.myapp.com/api' });
    expect(result).toBe('company');
  });

  it('should return null when url does not match suffix', async () => {
    const resolver = new SubdomainTenantResolver({ domainSuffix: '.myapp.com' });
    const result = await resolver.resolve({ url: 'https://company.otherapp.com/api' });
    expect(result).toBeNull();
  });

  it('should return null for invalid url', async () => {
    const resolver = new SubdomainTenantResolver();
    const result = await resolver.resolve({ url: 'not-a-valid-url' });
    expect(result).toBeNull();
  });

  it('should return null when url is undefined', async () => {
    const resolver = new SubdomainTenantResolver();
    const result = await resolver.resolve({});
    expect(result).toBeNull();
  });

  it('should handle multiple subdomains', async () => {
    const resolver = new SubdomainTenantResolver({ domainSuffix: '.myapp.com' });
    const result = await resolver.resolve({ url: 'https://team.company.myapp.com/api' });
    expect(result).toBe('team.company');
  });
});
