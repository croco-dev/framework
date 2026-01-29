import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../libs/guards/AuthGuard';
import type { ExecutionContext } from '../libs/interfaces/ExecutionContext';

type TokenVerifier = (token: string) => Promise<unknown> | unknown;

describe('AuthGuard', () => {
  let mockVerifier: ReturnType<typeof vi.fn>;
  let guard: AuthGuard;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockVerifier = vi.fn();
    guard = new AuthGuard({ verifier: mockVerifier as TokenVerifier });

    mockContext = {
      getRequest: vi.fn().mockReturnValue({
        headers: {},
      }),
      getClass: vi.fn(),
      getHandler: vi.fn(),
      getPath: vi.fn(),
      getMethod: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('should allow access with valid token', async () => {
    const mockRequest = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '123', name: 'Test User' });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({ id: '123', name: 'Test User' });
    expect(mockVerifier).toHaveBeenCalledWith('valid-token');
  });

  it('should deny access without Authorization header', async () => {
    mockContext.getRequest = vi.fn().mockReturnValue({ headers: {} });

    await expect(guard.canActivate(mockContext)).rejects.toThrow('Missing authorization header');
    expect(mockVerifier).not.toHaveBeenCalled();
  });

  it('should deny access with invalid token', async () => {
    const mockRequest = { headers: { authorization: 'Bearer invalid-token' } };
    (mockVerifier as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Token expired'));
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow('Invalid or expired token');
    expect(mockVerifier).toHaveBeenCalledWith('invalid-token');
  });

  it('should extract Bearer token correctly', async () => {
    const mockRequest = { headers: { authorization: 'Bearer my-token' } };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '456' });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockVerifier).toHaveBeenCalledWith('my-token');
  });

  it('should deny access with malformed token (no scheme)', async () => {
    const mockRequest = { headers: { authorization: 'just-a-token' } };
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow('Invalid authorization header format');
  });

  it('should deny access with wrong scheme', async () => {
    const mockRequest = { headers: { authorization: 'Basic token' } };
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockContext)).rejects.toThrow('Invalid authorization header format');
  });

  it('should use custom header name', async () => {
    const customVerifier = vi.fn();
    const customGuard = new AuthGuard({ verifier: customVerifier as TokenVerifier, headerName: 'x-auth-token' });
    const mockRequest = { headers: { 'x-auth-token': 'Bearer custom-token' }, user: undefined };
    (customVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '789' });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await customGuard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(customVerifier).toHaveBeenCalledWith('custom-token');
  });

  it('should use custom scheme', async () => {
    const customVerifier = vi.fn();
    const customGuard = new AuthGuard({ verifier: customVerifier as TokenVerifier, scheme: 'Token' });
    const mockRequest = { headers: { authorization: 'Token my-custom-token' }, user: undefined };
    (customVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '999' });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await customGuard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(customVerifier).toHaveBeenCalledWith('my-custom-token');
  });

  it('should handle case-insensitive scheme matching', async () => {
    const mockRequest = { headers: { authorization: 'bearer my-token' }, user: undefined };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '111' });
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockVerifier).toHaveBeenCalledWith('my-token');
  });

  it('should not set user if verifier returns falsy value', async () => {
    const mockRequest = { headers: { authorization: 'Bearer token' }, user: undefined };
    (mockVerifier as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockContext.getRequest = vi.fn().mockReturnValue(mockRequest);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(mockRequest.user).toBeUndefined();
  });
});
