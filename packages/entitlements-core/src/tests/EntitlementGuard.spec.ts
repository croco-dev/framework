import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTITLEMENT_REQUIRED_KEY } from '../libs/decorators/RequireEntitlement';
import { EntitlementGuard } from '../libs/EntitlementGuard';
import type { EntitlementManager } from '../libs/EntitlementManager';
import { EntitlementDeniedProblem } from '../libs/problems/EntitlementProblems';

class MockEntitlementManager {
  checkResult:
    | { granted: true; featureKey: string; type: string; planId: string }
    | { granted: false; reason: string } = {
    granted: true,
    featureKey: 'test_feature',
    type: 'boolean',
    planId: 'pro',
  };

  async check(_tenantId: string, _featureKey: string) {
    return this.checkResult;
  }
}

describe('EntitlementGuard', () => {
  let guard!: EntitlementGuard;
  let mockManager!: MockEntitlementManager;

  beforeEach(() => {
    Container.reset();
    mockManager = new MockEntitlementManager();
    guard = new EntitlementGuard(mockManager as unknown as EntitlementManager);
  });

  it('should pass when no metadata is present', async () => {
    const context = {
      getClass: () => ({}),
      getHandler: () => 'testMethod',
      getRequest: () =>
        ({
          tenantId: 'tenant-123',
          user: { tenantId: 'tenant-123' },
        }) as any,
    };

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should pass when entitlement is granted', async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, 'test_feature', TestController.prototype, 'testMethod');

    mockManager.checkResult = {
      granted: true,
      featureKey: 'test_feature',
      type: 'boolean',
      planId: 'pro',
    };

    const context = {
      getClass: () => TestController,
      getHandler: () => 'testMethod',
      getRequest: () =>
        ({
          tenantId: 'tenant-123',
          user: { tenantId: 'tenant-123' },
        }) as any,
    };

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw EntitlementDeniedProblem when entitlement is denied', async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, 'test_feature', TestController.prototype, 'testMethod');

    mockManager.checkResult = {
      granted: false,
      reason: 'limit_exceeded',
    };

    const context = {
      getClass: () => TestController,
      getHandler: () => 'testMethod',
      getRequest: () =>
        ({
          tenantId: 'tenant-123',
          user: { tenantId: 'tenant-123' },
        }) as any,
    };

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementDeniedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow('Entitlement');
  });

  it('should throw EntitlementDeniedProblem when tenantId is missing', async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, 'test_feature', TestController.prototype, 'testMethod');

    const context = {
      getClass: () => TestController,
      getHandler: () => 'testMethod',
      getRequest: () => ({}) as any,
    };

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementDeniedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow('tenantId not found');
  });

  it('should use request.tenantId when available', async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, 'test_feature', TestController.prototype, 'testMethod');

    mockManager.checkResult = {
      granted: true,
      featureKey: 'test_feature',
      type: 'boolean',
      planId: 'pro',
    };

    const checkSpy = vi.spyOn(mockManager, 'check');

    const context = {
      getClass: () => TestController,
      getHandler: () => 'testMethod',
      getRequest: () =>
        ({
          tenantId: 'tenant-from-request',
        }) as any,
    };

    await guard.canActivate(context);

    expect(checkSpy).toHaveBeenCalledWith('tenant-from-request', 'test_feature');
  });

  it('should fallback to user.tenantId when request.tenantId is missing', async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, 'test_feature', TestController.prototype, 'testMethod');

    mockManager.checkResult = {
      granted: true,
      featureKey: 'test_feature',
      type: 'boolean',
      planId: 'pro',
    };

    const checkSpy = vi.spyOn(mockManager, 'check');

    const context = {
      getClass: () => TestController,
      getHandler: () => 'testMethod',
      getRequest: () =>
        ({
          user: { tenantId: 'tenant-from-user' },
        }) as any,
    };

    await guard.canActivate(context);

    expect(checkSpy).toHaveBeenCalledWith('tenant-from-user', 'test_feature');
  });
});
