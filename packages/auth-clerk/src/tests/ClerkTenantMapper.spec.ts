import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkTenantMapper, type ClerkTenantRequest, type TenantMappingStore } from '../libs/ClerkTenantMapper';

describe('ClerkTenantMapper', () => {
  describe('InMemory Store', () => {
    let mapper!: ClerkTenantMapper;

    beforeEach(() => {
      mapper = new ClerkTenantMapper();
    });

    it('should register and resolve tenant', async () => {
      await mapper.register('org_123', 'tenant_abc');
      const tenantId = await mapper.resolve('org_123');
      expect(tenantId).toBe('tenant_abc');
    });

    it('should return null for unknown org', async () => {
      const tenantId = await mapper.resolve('org_unknown');
      expect(tenantId).toBeNull();
    });

    it('should remove tenant mapping', async () => {
      await mapper.register('org_123', 'tenant_abc');
      await mapper.remove('org_123');
      const tenantId = await mapper.resolve('org_123');
      expect(tenantId).toBeNull();
    });

    it('should resolve by request with auth user', async () => {
      await mapper.register('org_123', 'tenant_abc');

      const request: ClerkTenantRequest = {
        user: {
          id: 'user-1',
          roles: [],
          permissions: [],
          metadata: {
            orgId: 'org_123',
          },
        },
      };

      const tenantId = await mapper.resolve(request);
      expect(tenantId).toBe('tenant_abc');
    });

    it('should return null if request has no orgId', async () => {
      const request: ClerkTenantRequest = {
        user: {
          id: 'user-2',
          roles: [],
          permissions: [],
          metadata: {},
        },
      };

      const tenantId = await mapper.resolve(request);
      expect(tenantId).toBeNull();
    });
  });

  describe('Custom Store', () => {
    let mapper!: ClerkTenantMapper;
    let mockStore!: TenantMappingStore;

    beforeEach(() => {
      mockStore = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      mapper = new ClerkTenantMapper(mockStore);
    });

    it('should use custom store for get', async () => {
      vi.mocked(mockStore.get).mockResolvedValue('tenant_xyz');
      const result = await mapper.resolve('org_xyz');
      expect(result).toBe('tenant_xyz');
      expect(mockStore.get).toHaveBeenCalledWith('org_xyz');
    });

    it('should use custom store for set', async () => {
      await mapper.register('org_xyz', 'tenant_xyz');
      expect(mockStore.set).toHaveBeenCalledWith('org_xyz', 'tenant_xyz');
    });

    it('should use custom store for delete', async () => {
      await mapper.remove('org_xyz');
      expect(mockStore.delete).toHaveBeenCalledWith('org_xyz');
    });
  });
});
