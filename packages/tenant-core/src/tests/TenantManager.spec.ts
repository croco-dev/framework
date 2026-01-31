import { beforeEach, describe, expect, it } from 'vitest';
import { TenantManager } from '../libs/TenantManager';

describe('TenantManager', () => {
  let manager: TenantManager;

  beforeEach(() => {
    manager = new TenantManager();
  });

  describe('run', () => {
    it('should provide tenant context within the callback', async () => {
      await manager.run('tenant-123', async () => {
        expect(manager.getTenantId()).toBe('tenant-123');
      });
    });

    it('should propagate context through async boundaries', async () => {
      await manager.run('tenant-abc', async () => {
        await Promise.resolve();
        expect(manager.getTenantId()).toBe('tenant-abc');

        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(manager.getTenantId()).toBe('tenant-abc');
      });
    });

    it('should return the callback result', async () => {
      const result = await manager.run('tenant-1', async () => {
        return { data: 'test' };
      });

      expect(result).toEqual({ data: 'test' });
    });

    it('should support nested runs with different tenants', async () => {
      await manager.run('outer-tenant', async () => {
        expect(manager.getTenantId()).toBe('outer-tenant');

        await manager.run('inner-tenant', async () => {
          expect(manager.getTenantId()).toBe('inner-tenant');
        });

        expect(manager.getTenantId()).toBe('outer-tenant');
      });
    });
  });

  describe('getTenantId', () => {
    it('should return null outside of tenant context', () => {
      expect(manager.getTenantId()).toBeNull();
    });

    it('should return tenant ID within context', async () => {
      await manager.run('test-tenant', async () => {
        expect(manager.getTenantId()).toBe('test-tenant');
      });
    });
  });

  describe('requireTenantId', () => {
    it('should throw when not in tenant context', () => {
      expect(() => manager.requireTenantId()).toThrow('Tenant context is required');
    });

    it('should return tenant ID when in context', async () => {
      await manager.run('required-tenant', async () => {
        expect(manager.requireTenantId()).toBe('required-tenant');
      });
    });
  });

  describe('isInTenantContext', () => {
    it('should return false outside of context', () => {
      expect(manager.isInTenantContext()).toBe(false);
    });

    it('should return true inside context', async () => {
      await manager.run('any-tenant', async () => {
        expect(manager.isInTenantContext()).toBe(true);
      });
    });
  });

  describe('suspend', () => {
    it('should temporarily exit tenant context', async () => {
      await manager.run('main-tenant', async () => {
        expect(manager.getTenantId()).toBe('main-tenant');

        await manager.suspend(async () => {
          expect(manager.getTenantId()).toBeNull();
          expect(manager.isInTenantContext()).toBe(false);
        });

        expect(manager.getTenantId()).toBe('main-tenant');
      });
    });

    it('should allow new context creation within suspend', async () => {
      await manager.run('original', async () => {
        await manager.suspend(async () => {
          await manager.run('new-tenant', async () => {
            expect(manager.getTenantId()).toBe('new-tenant');
          });
        });

        expect(manager.getTenantId()).toBe('original');
      });
    });
  });
});
