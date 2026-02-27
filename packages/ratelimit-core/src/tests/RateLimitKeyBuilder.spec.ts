import { describe, expect, it } from 'vitest';
import { type KeyContext, RateLimitKeyBuilder } from '../libs/RateLimitKeyBuilder';

describe('RateLimitKeyBuilder', () => {
  const createContext = (data: Record<string, unknown>): KeyContext => ({
    get: <T>(key: string): T | undefined => data[key] as T | undefined,
  });

  describe('constructor', () => {
    it('should throw if no segments provided', () => {
      expect(() => new RateLimitKeyBuilder([])).toThrow('At least one key segment is required');
    });

    it('should accept valid segments', () => {
      const builder = new RateLimitKeyBuilder(['tenant', 'user']);
      expect(builder).not.toBeUndefined();
    });
  });

  describe('build', () => {
    it('should build key with tenant segment', () => {
      const builder = new RateLimitKeyBuilder(['tenant']);
      const context = createContext({ tenant: { id: 'tenant_123' } });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:tenant_123');
    });

    it('should build key with user segment', () => {
      const builder = new RateLimitKeyBuilder(['user']);
      const context = createContext({ user: { id: 'user_456' } });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:user_456');
    });

    it('should build key with ip segment', () => {
      const builder = new RateLimitKeyBuilder(['ip']);
      const context = createContext({ ip: '192.168.1.1' });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:192.168.1.1');
    });

    it('should build key with route segment', () => {
      const builder = new RateLimitKeyBuilder(['route']);
      const context = createContext({ method: 'GET', path: '/api/users' });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:GET:/api/users');
    });

    it('should build key with multiple segments', () => {
      const builder = new RateLimitKeyBuilder(['tenant', 'user', 'route']);
      const context = createContext({
        tenant: { id: 'tenant_123' },
        user: { id: 'user_456' },
        method: 'POST',
        path: '/api/orders',
      });

      const key = builder.build(context, 'premium');
      expect(key).toBe('rl:premium:tenant_123:user_456:POST:/api/orders');
    });

    it('should use empty string for missing segments', () => {
      const builder = new RateLimitKeyBuilder(['tenant', 'user']);
      const context = createContext({ tenant: { id: 'tenant_123' } });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:tenant_123:');
    });

    it('should support tenantId shorthand', () => {
      const builder = new RateLimitKeyBuilder(['tenant']);
      const context = createContext({ tenantId: 'tenant_789' });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:tenant_789');
    });

    it('should support clientIp shorthand', () => {
      const builder = new RateLimitKeyBuilder(['ip']);
      const context = createContext({ clientIp: '10.0.0.1' });

      const key = builder.build(context, 'api-default');
      expect(key).toBe('rl:api-default:10.0.0.1');
    });
  });
});
