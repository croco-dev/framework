import 'reflect-metadata';
import type { AuthProvider } from '@croco/auth-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BetterAuthFactory } from '../libs/BetterAuthFactory';
import { BetterAuthProvider } from '../libs/BetterAuthProvider';

function createMockBetterAuthFactory(session: any): BetterAuthFactory {
  return {
    getAuth: () => ({
      api: {
        getSession: vi.fn().mockResolvedValue(session),
      },
    }),
  } as unknown as BetterAuthFactory;
}

function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: new Headers(headers),
  } as unknown as Request;
}

describe('BetterAuthProvider', () => {
  let provider!: BetterAuthProvider;
  let mockFactory!: BetterAuthFactory;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return AuthUser when session exists', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'John Doe',
          image: 'https://example.com/avatar.jpg',
          emailVerified: true,
        },
        session: {
          id: 'session-456',
          expiresAt: new Date(Date.now() + 3600000),
          token: 'session-token-abc',
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest({
        authorization: 'Bearer session-token-abc',
      });

      const result = await provider.authenticate(request);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        roles: [],
        permissions: [],
        metadata: {
          image: 'https://example.com/avatar.jpg',
          emailVerified: true,
        },
      });
    });

    it('should return null when session does not exist', async () => {
      mockFactory = createMockBetterAuthFactory(null);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();

      const result = await provider.authenticate(request);

      expect(result).toBeNull();
    });

    it('should handle session with minimal user data', async () => {
      const mockSession = {
        user: {
          id: 'user-minimal',
          email: 'minimal@example.com',
          emailVerified: false,
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();

      const result = await provider.authenticate(request);

      expect(result).toEqual({
        id: 'user-minimal',
        email: 'minimal@example.com',
        roles: [],
        permissions: [],
        metadata: {
          image: undefined,
          emailVerified: false,
        },
      });
    });

    it('should pass request headers to getSession API', async () => {
      const mockSession = {
        user: {
          id: 'user-456',
          email: 'test@example.com',
          emailVerified: true,
        },
      };

      const getSessionSpy = vi.fn().mockResolvedValue(mockSession);
      const mockAuth = {
        api: {
          getSession: getSessionSpy,
        },
      };

      const factoryWithSpy = {
        getAuth: () => mockAuth,
      } as unknown as BetterAuthFactory;

      provider = new BetterAuthProvider(factoryWithSpy);

      const customHeaders = {
        authorization: 'Bearer custom-token',
        'user-agent': 'TestAgent/1.0',
        'x-forwarded-for': '192.168.1.1',
      };
      const request = createMockRequest(customHeaders);

      await provider.authenticate(request);

      expect(getSessionSpy).toHaveBeenCalledWith({
        headers: request.headers,
      });

      const capturedHeaders = getSessionSpy.mock.calls[0][0].headers;
      expect(capturedHeaders.get('authorization')).toBe('Bearer custom-token');
      expect(capturedHeaders.get('user-agent')).toBe('TestAgent/1.0');
      expect(capturedHeaders.get('x-forwarded-for')).toBe('192.168.1.1');
    });

    it('should handle user with image but no emailVerified flag', async () => {
      const mockSession = {
        user: {
          id: 'user-789',
          email: 'image@example.com',
          image: 'https://example.com/no-verified.jpg',
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();

      const result = await provider.authenticate(request);

      expect(result).toEqual({
        id: 'user-789',
        email: 'image@example.com',
        roles: [],
        permissions: [],
        metadata: {
          image: 'https://example.com/no-verified.jpg',
          emailVerified: undefined,
        },
      });
    });

    it('should initialize with empty roles and permissions arrays', async () => {
      const mockSession = {
        user: {
          id: 'user-roles',
          email: 'roles@example.com',
          emailVerified: true,
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();
      const result = await provider.authenticate(request);

      expect(result?.roles).toEqual([]);
      expect(result?.permissions).toEqual([]);
      expect(Array.isArray(result?.roles)).toBe(true);
      expect(Array.isArray(result?.permissions)).toBe(true);
    });

    it('should implement AuthProvider interface', () => {
      mockFactory = createMockBetterAuthFactory(null);
      provider = new BetterAuthProvider(mockFactory);

      expect(provider).toHaveProperty('authenticate');
      expect(typeof provider.authenticate).toBe('function');

      const providerAsInterface: AuthProvider<Request> = provider;
      expect(providerAsInterface.authenticate).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Network error');
      const errorFactory = {
        getAuth: () => ({
          api: {
            getSession: vi.fn().mockRejectedValue(mockError),
          },
        }),
      } as unknown as BetterAuthFactory;

      provider = new BetterAuthProvider(errorFactory);

      const request = createMockRequest();

      await expect(provider.authenticate(request)).rejects.toThrow('Network error');
    });

    it('should handle malformed session response', async () => {
      const malformedSession = {
        user: null,
      };

      mockFactory = createMockBetterAuthFactory(malformedSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();

      await expect(provider.authenticate(request)).rejects.toThrow();
    });
  });

  describe('constructor', () => {
    it('should accept BetterAuthFactory dependency', () => {
      mockFactory = createMockBetterAuthFactory(null);

      expect(() => new BetterAuthProvider(mockFactory)).not.toThrow();
    });

    it('should store factory reference', () => {
      mockFactory = createMockBetterAuthFactory(null);
      provider = new BetterAuthProvider(mockFactory);

      const factory = (provider as any).factory;
      expect(factory).toBe(mockFactory);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical login flow', async () => {
      const mockSession = {
        user: {
          id: 'user-login',
          email: 'newuser@example.com',
          name: 'New User',
          emailVerified: true,
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const loginRequest = createMockRequest({
        authorization: 'Bearer login-session-token',
      });

      const authUser = await provider.authenticate(loginRequest);

      expect(authUser?.id).toBe('user-login');
      expect(authUser?.email).toBe('newuser@example.com');
    });

    it('should handle logout scenario (no session)', async () => {
      mockFactory = createMockBetterAuthFactory(null);
      provider = new BetterAuthProvider(mockFactory);

      const logoutRequest = createMockRequest();

      const result = await provider.authenticate(logoutRequest);

      expect(result).toBeNull();
    });
  });

  describe('metadata mapping', () => {
    it('should map emailVerified to metadata', async () => {
      const mockSession = {
        user: {
          id: 'user-meta',
          email: 'meta@example.com',
          emailVerified: true,
          image: 'https://example.com/avatar.png',
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();
      const result = await provider.authenticate(request);

      expect(result?.metadata).toBeDefined();
      expect(result?.metadata?.emailVerified).toBe(true);
      expect(result?.metadata?.image).toBe('https://example.com/avatar.png');
    });

    it('should handle missing optional fields', async () => {
      const mockSession = {
        user: {
          id: 'user-partial',
          email: 'partial@example.com',
        },
      };

      mockFactory = createMockBetterAuthFactory(mockSession);
      provider = new BetterAuthProvider(mockFactory);

      const request = createMockRequest();
      const result = await provider.authenticate(request);

      expect(result?.metadata).toBeDefined();
      expect(result?.metadata?.image).toBeUndefined();
      expect(result?.metadata?.emailVerified).toBeUndefined();
    });
  });
});
