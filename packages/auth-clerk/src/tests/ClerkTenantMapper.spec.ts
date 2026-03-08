import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkTenantMapper, type ClerkTenantRequest, type TenantMappingStore } from '../libs/ClerkTenantMapper';
import { DuplicateTenantMappingProblem } from '../libs/problems/ClerkProblems';

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

    it('should allow idempotent registration for the same tenant mapping', async () => {
      await mapper.register('org_123', 'tenant_abc');

      await expect(mapper.register('org_123', 'tenant_abc')).resolves.toBeUndefined();
      await expect(mapper.resolve('org_123')).resolves.toBe('tenant_abc');
    });

    it('should fail fast when an org is remapped to a different tenant', async () => {
      await mapper.register('org_123', 'tenant_abc');

      await expect(mapper.register('org_123', 'tenant_xyz')).rejects.toBeInstanceOf(DuplicateTenantMappingProblem);
      await expect(mapper.resolve('org_123')).resolves.toBe('tenant_abc');
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
      vi.mocked(mockStore.get).mockResolvedValue(null);

      await mapper.register('org_xyz', 'tenant_xyz');

      expect(mockStore.get).toHaveBeenCalledWith('org_xyz');
      expect(mockStore.set).toHaveBeenCalledWith('org_xyz', 'tenant_xyz');
    });

    it('should use custom store for delete', async () => {
      await mapper.remove('org_xyz');
      expect(mockStore.delete).toHaveBeenCalledWith('org_xyz');
    });

    it('should allow idempotent registration for an existing custom store mapping', async () => {
      vi.mocked(mockStore.get).mockResolvedValue('tenant_xyz');

      await expect(mapper.register('org_xyz', 'tenant_xyz')).resolves.toBeUndefined();

      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('should fail fast when a custom store mapping would be overwritten', async () => {
      vi.mocked(mockStore.get).mockResolvedValue('tenant_abc');

      await expect(mapper.register('org_xyz', 'tenant_xyz')).rejects.toBeInstanceOf(DuplicateTenantMappingProblem);

      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });
});
