import 'reflect-metadata';
import type { ExecutionContext } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_PERMISSIONS_KEY } from '../libs/constants';
import { PermissionGuard } from '../libs/guards/PermissionGuard';
import type { AuthUser } from '../libs/interfaces/AuthUser';
import { ForbiddenProblem } from '../libs/problems/AuthProblems';
import type { RbacEngine } from '../libs/rbac/RbacEngine';

describe('PermissionGuard', () => {
  let permissionGuard: PermissionGuard;
  let mockRbacEngine: RbacEngine;

  const mockUser = { id: 'user-1' } as AuthUser;

  const createMockContext = (target: any, handlerName: string, user?: AuthUser) => {
    const request = {
      headers: new Headers(),
      user,
    } as unknown as Request;

    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => '/test',
      getMethod: () => 'GET',
    } as unknown as ExecutionContext;
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
});
