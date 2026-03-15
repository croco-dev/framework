import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_PERMISSIONS_KEY } from '../libs/constants';
import { PermissionGuard } from '../libs/guards/PermissionGuard';
import type { AuthRequest } from '../libs/interfaces/AuthRequest';
import type { AuthUser } from '../libs/interfaces/AuthUser';
import type { ApiKeyPrincipal, UserPrincipal } from '../libs/interfaces/Principal';
import type { RouteExecutionContext } from '../libs/interfaces/RouteExecutionContext';
import { ForbiddenProblem } from '../libs/problems/AuthProblems';
import type { RbacEngine } from '../libs/rbac/RbacEngine';

describe('PermissionGuard', () => {
  let permissionGuard!: PermissionGuard;
  let mockRbacEngine!: RbacEngine;

  const mockUser = { id: 'user-1' } as AuthUser;

  const createMockContext = (
    target: unknown,
    handlerName: string,
    user?: AuthUser,
    principal?: ApiKeyPrincipal | UserPrincipal
  ) => {
    const request = {
      headers: new Headers(),
    } as unknown as AuthRequest;

    if (user) {
      request.user = user;
    }
    if (principal) {
      request.principal = principal;
    }

    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => '/test',
      getMethod: () => 'GET',
    } as RouteExecutionContext;
  };

  beforeEach(() => {
    mockRbacEngine = {
      hasPermission: vi.fn(),
      hasRole: vi.fn(),
    } as unknown as RbacEngine;

    permissionGuard = new PermissionGuard(mockRbacEngine);
  });

  it('should return true when no permissions are required', () => {
    class TestController {
      publicMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'publicMethod', mockUser);

    expect(permissionGuard.canActivate(context)).toBe(true);
  });

  it('should return false when user is not authenticated but permissions are required', () => {
    class TestController {
      protectedMethod() {}
    }
    Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, ['required:perm'], TestController.prototype, 'protectedMethod');

    const context = createMockContext(TestController.prototype, 'protectedMethod', undefined);

    expect(permissionGuard.canActivate(context)).toBe(false);
  });

  it('should return true when user has all required permissions', () => {
    class TestController {
      protectedMethod() {}
    }
    const requiredPerms = ['perm:1', 'perm:2'];
    Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, requiredPerms, TestController.prototype, 'protectedMethod');

    const context = createMockContext(TestController.prototype, 'protectedMethod', mockUser);

    vi.spyOn(mockRbacEngine, 'hasPermission').mockReturnValue(true);

    expect(permissionGuard.canActivate(context)).toBe(true);
    expect(mockRbacEngine.hasPermission).toHaveBeenCalledTimes(2);
    expect(mockRbacEngine.hasPermission).toHaveBeenCalledWith(mockUser, 'perm:1');
    expect(mockRbacEngine.hasPermission).toHaveBeenCalledWith(mockUser, 'perm:2');
  });

  it('should throw ForbiddenProblem when user misses a permission', () => {
    class TestController {
      protectedMethod() {}
    }
    const requiredPerms = ['perm:1', 'perm:2'];
    Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, requiredPerms, TestController.prototype, 'protectedMethod');

    const context = createMockContext(TestController.prototype, 'protectedMethod', mockUser);

    vi.spyOn(mockRbacEngine, 'hasPermission').mockImplementation((_user, perm) => {
      return perm === 'perm:1';
    });

    expect(() => permissionGuard.canActivate(context)).toThrow(ForbiddenProblem);
  });

  describe('with ApiKeyPrincipal', () => {
    const mockApiKeyPrincipal: ApiKeyPrincipal = {
      type: 'apikey',
      id: 'key-1',
      keyId: 'key-id-1',
      name: 'Test API Key',
      keyStart: 'sk_test_...',
      permissions: ['api:read', 'api:write'],
    };

    it('should return true when ApiKeyPrincipal has all required permissions', () => {
      class TestController {
        apiMethod() {}
      }
      Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, ['api:read'], TestController.prototype, 'apiMethod');

      const context = createMockContext(TestController.prototype, 'apiMethod', undefined, mockApiKeyPrincipal);

      expect(permissionGuard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenProblem when ApiKeyPrincipal misses a permission', () => {
      class TestController {
        apiMethod() {}
      }
      Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, ['api:delete'], TestController.prototype, 'apiMethod');

      const context = createMockContext(TestController.prototype, 'apiMethod', undefined, mockApiKeyPrincipal);

      expect(() => permissionGuard.canActivate(context)).toThrow(ForbiddenProblem);
    });

    it('should not call RbacEngine for ApiKeyPrincipal', () => {
      class TestController {
        apiMethod() {}
      }
      Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, ['api:read'], TestController.prototype, 'apiMethod');

      const context = createMockContext(TestController.prototype, 'apiMethod', undefined, mockApiKeyPrincipal);
      const hasPermissionSpy = vi.spyOn(mockRbacEngine, 'hasPermission');

      permissionGuard.canActivate(context);

      expect(hasPermissionSpy).not.toHaveBeenCalled();
    });
  });

  describe('principal fallback', () => {
    const mockUserPrincipal: UserPrincipal = {
      type: 'user',
      id: 'user-1',
      email: 'test@example.com',
      roles: ['admin'],
      permissions: ['user:read'],
    };

    it('should use principal when both principal and user exist', () => {
      class TestController {
        protectedMethod() {}
      }
      Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, ['user:read'], TestController.prototype, 'protectedMethod');

      const context = createMockContext(TestController.prototype, 'protectedMethod', mockUser, mockUserPrincipal);

      vi.spyOn(mockRbacEngine, 'hasPermission').mockReturnValue(true);

      permissionGuard.canActivate(context);

      expect(mockRbacEngine.hasPermission).toHaveBeenCalledWith(mockUserPrincipal, 'user:read');
    });

    it('should fall back to user when principal does not exist', () => {
      class TestController {
        protectedMethod() {}
      }
      Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, ['user:read'], TestController.prototype, 'protectedMethod');

      const context = createMockContext(TestController.prototype, 'protectedMethod', mockUser);

      vi.spyOn(mockRbacEngine, 'hasPermission').mockReturnValue(true);

      permissionGuard.canActivate(context);

      expect(mockRbacEngine.hasPermission).toHaveBeenCalledWith(mockUser, 'user:read');
    });
  });
});
