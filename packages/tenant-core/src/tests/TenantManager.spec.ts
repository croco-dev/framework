import { Context } from '@croco/framework-context';
import * as telemetry from '@croco/telemetry-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantRequiredProblem } from '../libs/problems/TenantRequiredProblem';
import { TenantManager } from '../libs/TenantManager';

describe('TenantManager', () => {
  let manager!: TenantManager;

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

    it('should record tenant context entry event', async () => {
      const recordEventSpy = vi.spyOn(telemetry, 'recordEvent').mockImplementation(() => {});

      await manager.run('tenant-observe', async () => {
        expect(manager.getTenantId()).toBe('tenant-observe');
      });

      expect(recordEventSpy).toHaveBeenCalledWith('tenant.context.enter', {
        'tenant.id': 'tenant-observe',
      });

      recordEventSpy.mockRestore();
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

    it('should read tenant ID from framework context', async () => {
      await Context.run({ requestId: 'req-1', tenantId: 'context-tenant' }, async () => {
        expect(manager.getTenantId()).toBe('context-tenant');
      });
    });
  });

  describe('requireTenantId', () => {
    it('should throw when not in tenant context', () => {
      expect(() => manager.requireTenantId()).toThrow(TenantRequiredProblem);
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

  describe('context synchronization', () => {
    it('should expose tenant ID through framework context when using TenantManager', async () => {
      await manager.run('tenant-from-manager', async () => {
        expect(Context.getTenantId()).toBe('tenant-from-manager');
      });
    });

    it('should preserve existing request context fields when overriding tenant', async () => {
      await Context.run(
        { requestId: 'req-2', user: { id: 'user-1' }, traceId: 'trace-1', tenantId: 'outer' },
        async () => {
          await manager.run('inner', async () => {
            expect(Context.getRequestId()).toBe('req-2');
            expect(Context.getCurrentUser()).toEqual({ id: 'user-1' });
            expect(Context.getActiveTraceId()).toBe('trace-1');
            expect(Context.getTenantId()).toBe('inner');
          });

          expect(Context.getTenantId()).toBe('outer');
        }
      );
    });
  });
});
