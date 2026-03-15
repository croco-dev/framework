import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_PUBLIC_KEY } from '../libs/constants';
import { AuthGuard } from '../libs/guards/AuthGuard';
import type { AuthProvider } from '../libs/interfaces/AuthProvider';
import type { AuthRequest } from '../libs/interfaces/AuthRequest';
import type { AuthUser } from '../libs/interfaces/AuthUser';
import type { RouteExecutionContext } from '../libs/interfaces/RouteExecutionContext';
import { UnauthorizedProblem } from '../libs/problems/AuthProblems';

describe('AuthGuard', () => {
  let authGuard!: AuthGuard;
  let mockAuthProvider!: AuthProvider;

  // Mock objects
  const mockUser = { id: 'user-1' } as AuthUser;

  // Mock context factory
  const createMockContext = (target: unknown, handlerName: string) => {
    const request = { headers: new Headers() } as unknown as AuthRequest;
    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => '/test',
      getMethod: () => 'GET',
    } as RouteExecutionContext;
  };

  beforeEach(() => {
    mockAuthProvider = {
      authenticate: vi.fn(),
    };
    authGuard = new AuthGuard(mockAuthProvider);
  });

  it('should return true when route is public', async () => {
    class TestController {
      publicMethod() {}
    }
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, TestController.prototype, 'publicMethod');

    const context = createMockContext(TestController.prototype, 'publicMethod');
    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should return true when controller is public', async () => {
    @Reflect.metadata(AUTH_PUBLIC_KEY, true)
    class PublicController {
      method() {}
    }
    // Note: In TypeScript decorators, metadata is defined on the constructor for class decorators
    // But AuthGuard checks: Reflect.getMetadata(AUTH_PUBLIC_KEY, target.constructor)
    // context.getClass() usually returns the prototype or instance depending on implementation
    // Let's assume context.getClass() returns prototype, so target.constructor is the class

    // Manually mocking what decorator does if needed, but Reflect.metadata should work
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, PublicController);

    const context = createMockContext(PublicController.prototype, 'method');
    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should authenticate and attach user to request', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod');

    // Mock successful authentication
    vi.spyOn(mockAuthProvider, 'authenticate').mockResolvedValue(mockUser);

    const result = await authGuard.canActivate(context);

    expect(result).toBe(true);
    expect(mockAuthProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(context.getRequest().user).toBe(mockUser);
  });

  it('should throw UnauthorizedProblem when authentication fails', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod');

    // Mock failed authentication
    vi.spyOn(mockAuthProvider, 'authenticate').mockResolvedValue(null);

    await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
  });
});
