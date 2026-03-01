import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkAuthProvider } from '../libs/ClerkAuthProvider';

type VerifiedToken = Awaited<ReturnType<typeof verifyToken>>;

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(),
  verifyToken: vi.fn(),
}));

describe('ClerkAuthProvider', () => {
  let authProvider!: ClerkAuthProvider;
  const options = { secretKey: 'sk_test_123', publishableKey: 'pk_test_123' };

  beforeEach(() => {
    vi.clearAllMocks();
    authProvider = new ClerkAuthProvider(options);
  });

  const createRequest = (authHeader?: string) => {
    const headers = new Headers();
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }
    return {
      headers,
    } as unknown as Request;
  };

  it('should return null if Authorization header is missing', async () => {
    const request = createRequest();
    const result = await authProvider.authenticate(request);
    expect(result).toBeNull();
  });

  it('should return null if Authorization header is not Bearer', async () => {
    const request = createRequest('Basic token');
    const result = await authProvider.authenticate(request);
    expect(result).toBeNull();
  });

  it('should return null if token verification fails', async () => {
    const request = createRequest('Bearer invalid-token');
    vi.mocked(verifyToken).mockRejectedValue(new Error('Invalid token'));

    const result = await authProvider.authenticate(request);
    expect(result).toBeNull();
  });

  it('should return AuthUser on successful verification', async () => {
    const request = createRequest('Bearer valid-token');
    const mockVerifiedToken = {
      sub: 'user_123',
      email: 'test@example.com',
      org_id: 'org_123',
      org_role: 'admin',
      org_permissions: ['perm:read', 'perm:write'],
      org_slug: 'my-org',
      sid: 'sess_123',
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    const result = await authProvider.authenticate(request);

    expect(result).toEqual({
      id: 'user_123',
      email: 'test@example.com',
      roles: ['admin'],
      permissions: ['perm:read', 'perm:write'],
      metadata: {
        clerkUserId: 'user_123',
        orgId: 'org_123',
        orgRole: 'admin',
        orgSlug: 'my-org',
        sessionId: 'sess_123',
      },
    });

    expect(verifyToken).toHaveBeenCalledWith('valid-token', { secretKey: options.secretKey });
  });

  it('should discard org_permissions when it contains non-string values', async () => {
    const request = createRequest('Bearer valid-token');
    const mockVerifiedToken = {
      sub: 'user_123',
      org_role: 'admin',
      org_permissions: ['perm:read', 123],
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    const result = await authProvider.authenticate(request);

    expect(result?.roles).toEqual(['admin']);
    expect(result?.permissions).toEqual([]);
  });

  it('should discard org_permissions when claim is not an array', async () => {
    const request = createRequest('Bearer valid-token');
    const mockVerifiedToken = {
      sub: 'user_123',
      org_permissions: 'perm:read',
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    const result = await authProvider.authenticate(request);

    expect(result?.permissions).toEqual([]);
  });

  it('should handle missing optional fields correctly', async () => {
    const request = createRequest('Bearer valid-token');
    const mockVerifiedToken = {
      sub: 'user_123',
      // Missing email, org info
    };

    vi.mocked(verifyToken).mockResolvedValue(mockVerifiedToken as unknown as VerifiedToken);

    const result = await authProvider.authenticate(request);

    expect(result).toEqual({
      id: 'user_123',
      email: undefined,
      roles: [],
      permissions: [],
      metadata: {
        clerkUserId: 'user_123',
        orgId: undefined,
        orgRole: undefined,
        orgSlug: undefined,
        sessionId: undefined,
      },
    });
  });
});
