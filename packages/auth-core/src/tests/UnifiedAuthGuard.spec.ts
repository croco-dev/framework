import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_PUBLIC_KEY } from '../libs/constants';
import { UnifiedAuthGuard } from '../libs/guards/UnifiedAuthGuard';
import type { ApiKeyProvider } from '../libs/interfaces/ApiKeyProvider';
import type { AuthProvider } from '../libs/interfaces/AuthProvider';
import type { AuthRequest } from '../libs/interfaces/AuthRequest';
import type { AuthUser } from '../libs/interfaces/AuthUser';
import type { RouteExecutionContext } from '../libs/interfaces/Guard';
import type { ApiKeyPrincipal } from '../libs/interfaces/Principal';
import { UnauthorizedProblem } from '../libs/problems/AuthProblems';

describe('UnifiedAuthGuard', () => {
  let guard!: UnifiedAuthGuard;
  let mockAuthProvider!: AuthProvider & { authenticate: ReturnType<typeof vi.fn> };
  let mockApiKeyProvider!: ApiKeyProvider & { authenticate: ReturnType<typeof vi.fn> };

  const mockUser: AuthUser = {
    id: 'user-1',
    email: 'test@example.com',
    roles: ['user'],
    permissions: ['read:users'],
  };

  const mockApiKeyPrincipal: ApiKeyPrincipal = {
    type: 'apikey',
    id: 'api-key-1',
    keyId: 'kid_123',
    name: 'Test API Key',
    keyStart: 'pk_test_...',
    permissions: ['read:users'],
    tenantId: 'tenant-1',
  };

  const createMockContext = (
    target: unknown,
    handlerName: string,
    headers: Record<string, string> = {}
  ): RouteExecutionContext => {
    const request = { headers } as unknown as AuthRequest;
    return {
      getRequest: () => request,
      getClass: () => target,
      getHandler: () => handlerName,
      getPath: () => '/test',
      getMethod: () => 'GET',
    } as RouteExecutionContext;
  };

  const createRequestContext = (
    target: unknown,
    handlerName: string,
    headersInit: HeadersInit = {}
  ): RouteExecutionContext => {
    const request: AuthRequest = new Request('https://example.com/test', {
      headers: new Headers(headersInit),
    });

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
    mockApiKeyProvider = {
      authenticate: vi.fn(),
    };
    guard = new UnifiedAuthGuard(mockAuthProvider, mockApiKeyProvider);
  });

  it('should return true when route is public', async () => {
    class TestController {
      publicMethod() {}
    }
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, TestController.prototype, 'publicMethod');

    const context = createMockContext(TestController.prototype, 'publicMethod', {
      'x-api-key': 'pk_test_key',
    });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should authenticate with API key when X-API-Key header is present', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {
      'x-api-key': 'pk_test_valid_key',
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toBe(mockApiKeyPrincipal);
    expect(request.apiKey).toBe(mockApiKeyPrincipal);
    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should authenticate with API key when X-API-Key header is uppercase', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {
      'X-API-Key': 'pk_test_valid_key',
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toBe(mockApiKeyPrincipal);
    expect(request.apiKey).toBe(mockApiKeyPrincipal);
  });

  it('should authenticate with API key when request uses Headers object', async () => {
    class TestController {
      protectedMethod() {}
    }

    const context = createRequestContext(TestController.prototype, 'protectedMethod', {
      'x-api-key': 'pk_test_valid_key',
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toBe(mockApiKeyPrincipal);
    expect(request.apiKey).toBe(mockApiKeyPrincipal);
    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedProblem when API key is invalid', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {
      'x-api-key': 'pk_test_invalid_key',
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
    expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should authenticate with user when no API key header is present', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {});
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    const result = await guard.canActivate(context);
    const request = context.getRequest();

    expect(result).toBe(true);
    expect(request.principal).toEqual({ ...mockUser, type: 'user' });
    expect(request.user).toBe(mockUser);
    expect(mockAuthProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedProblem when both API key and user authentication fail', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {});
    mockAuthProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedProblem when no credentials are provided', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {});
    mockAuthProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
  });

  it('should prefer lowercase x-api-key header when both exist', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {
      'x-api-key': 'lowercase_key',
      'X-API-Key': 'uppercase_key',
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockApiKeyPrincipal);

    await guard.canActivate(context);

    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledTimes(1);
  });

  it('should not set principal/user when authentication returns null', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {});
    mockAuthProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow();

    const request = context.getRequest();
    expect(request.principal).toBeUndefined();
    expect(request.user).toBeUndefined();
  });

  it('should pass the original request to providers', async () => {
    class TestController {
      protectedMethod() {}
    }
    const context = createMockContext(TestController.prototype, 'protectedMethod', {});
    mockAuthProvider.authenticate.mockResolvedValue(mockUser);

    await guard.canActivate(context);

    expect(mockAuthProvider.authenticate).toHaveBeenCalledTimes(1);
    const requestArg = mockAuthProvider.authenticate.mock.calls[0][0];
    expect(requestArg).toBe(context.getRequest());
  });
});
