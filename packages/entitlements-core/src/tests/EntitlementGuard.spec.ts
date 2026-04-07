import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENTITLEMENT_REQUIRED_KEY } from '../libs/decorators/RequireEntitlement';
import { EntitlementGuard, type RouteExecutionContext } from '../libs/EntitlementGuard';
import type { EntitlementManager } from '../libs/EntitlementManager';
import { EntitlementDeniedProblem } from '../libs/problems/EntitlementProblems';

class MockEntitlementManager {
  checkResult:
    | { granted: true; featureKey: string; type: string; planId: string }
    | { granted: false; featureKey: string; type: string; reason: string } = {
    granted: true,
    featureKey: 'test_feature',
    type: 'boolean',
    planId: 'pro',
  };

  async check(_tenantId: string, _featureKey: string) {
    return this.checkResult;
  }
}

type RequestWithTenant = RouteExecutionContext['getRequest'] extends () => infer T ? T : never;
type RequestWithOptionalTenantUser = Omit<RequestWithTenant, 'user'> & {
  user?: RequestWithTenant['user'] & { tenantId?: string };
};

function createUser(tenantId: string): RequestWithOptionalTenantUser['user'] {
  return {
    id: 'user-1',
    roles: [],
    permissions: [],
    tenantId,
  };
}

function createContext(options: {
  target?: unknown;
  handler?: string | symbol;
  request?: Partial<RequestWithOptionalTenantUser>;
}): RouteExecutionContext {
  return {
    getClass: () => options.target ?? {},
    getHandler: () => options.handler ?? 'testMethod',
    getRequest: () => options.request as RequestWithTenant,
  };
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
    const context = createContext({
      request: {
        tenantId: 'tenant-123',
        user: createUser('tenant-123'),
      },
    });

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

    const context = createContext({
      target: TestController,
      request: {
        tenantId: 'tenant-123',
        user: createUser('tenant-123'),
      },
    });

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
      featureKey: 'test_feature',
      type: 'boolean',
      reason: 'limit_exceeded',
    };

    const context = createContext({
      target: TestController,
      request: {
        tenantId: 'tenant-123',
        user: createUser('tenant-123'),
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(EntitlementDeniedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow('Entitlement');
  });

  it('should throw EntitlementDeniedProblem when tenantId is missing', async () => {
    class TestController {
      testMethod() {}
    }

    Reflect.defineMetadata(ENTITLEMENT_REQUIRED_KEY, 'test_feature', TestController.prototype, 'testMethod');

    const context = createContext({
      target: TestController,
      request: {},
    });

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
    const context = createContext({
      target: TestController,
      request: {
        tenantId: 'tenant-from-request',
      },
    });

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
    const context = createContext({
      target: TestController,
      request: {
        user: createUser('tenant-from-user'),
      },
    });

    await guard.canActivate(context);

    expect(checkSpy).toHaveBeenCalledWith('tenant-from-user', 'test_feature');
  });
});
