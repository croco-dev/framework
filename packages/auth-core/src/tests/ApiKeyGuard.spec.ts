import 'reflect-metadata';
import type { ExecutionContext } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyGuard } from '../libs/guards/ApiKeyGuard';
import type { ApiKeyProvider } from '../libs/interfaces/ApiKeyProvider';
import type { ApiKeyPrincipal } from '../libs/interfaces/Principal';
import { UnauthorizedProblem } from '../libs/problems/AuthProblems';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockApiKeyProvider: ApiKeyProvider & { authenticate: ReturnType<typeof vi.fn> };

  const mockPrincipal: ApiKeyPrincipal = {
    type: 'apikey',
    id: 'api-key-1',
    keyId: 'kid_123',
    name: 'Test API Key',
    keyStart: 'pk_test_...',
    permissions: ['read:users'],
    tenantId: 'tenant-1',
  };

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    const request = { headers } as unknown as Request;
    return {
      getRequest: () => request,
      getClass: () => class TestController {} as never,
      getHandler: () => 'testMethod',
      getPath: () => '/test',
      getMethod: () => 'GET',
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockApiKeyProvider = {
      authenticate: vi.fn(),
    };
    guard = new ApiKeyGuard(mockApiKeyProvider);
  });

  it('should allow access with valid API key', async () => {
    const context = createMockContext({ 'x-api-key': 'pk_test_valid_key' });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest() as unknown as Record<string, unknown>;

    expect(result).toBe(true);
    expect(request.principal).toBe(mockPrincipal);
    expect(request.apiKey).toBe(mockPrincipal);
    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
  });

  it('should allow access with X-API-Key header (uppercase)', async () => {
    const context = createMockContext({ 'X-API-Key': 'pk_test_valid_key' });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockPrincipal);

    const result = await guard.canActivate(context);
    const request = context.getRequest() as unknown as Record<string, unknown>;

    expect(result).toBe(true);
    expect(request.principal).toBe(mockPrincipal);
    expect(request.apiKey).toBe(mockPrincipal);
  });

  it('should throw UnauthorizedProblem when API key header is missing', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow('Missing API key');
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedProblem when API key is invalid', async () => {
    const context = createMockContext({ 'x-api-key': 'pk_test_invalid_key' });
    mockApiKeyProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
  });

  it('should handle empty API key header', async () => {
    const context = createMockContext({ 'x-api-key': '' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedProblem);
    expect(mockApiKeyProvider.authenticate).not.toHaveBeenCalled();
  });

  it('should prefer lowercase x-api-key header when both exist', async () => {
    const context = createMockContext({
      'x-api-key': 'lowercase_key',
      'X-API-Key': 'uppercase_key',
    });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockPrincipal);

    await guard.canActivate(context);

    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith(context.getRequest());
  });

  it('should not set principal/apiKey when authentication returns null', async () => {
    const context = createMockContext({ 'x-api-key': 'pk_test_key' });
    mockApiKeyProvider.authenticate.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow();

    const request = context.getRequest() as unknown as Record<string, unknown>;
    expect(request.principal).toBeUndefined();
    expect(request.apiKey).toBeUndefined();
  });

  it('should pass the original request to ApiKeyProvider', async () => {
    const context = createMockContext({ 'x-api-key': 'pk_test_key' });
    mockApiKeyProvider.authenticate.mockResolvedValue(mockPrincipal);

    await guard.canActivate(context);

    expect(mockApiKeyProvider.authenticate).toHaveBeenCalledTimes(1);
    const requestArg = mockApiKeyProvider.authenticate.mock.calls[0][0];
    expect(requestArg).toBe(context.getRequest());
  });
});
