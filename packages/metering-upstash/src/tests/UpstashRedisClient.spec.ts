import type { Redis } from '@upstash/redis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUpstashRedisClient, UpstashRedisClient } from '../libs/UpstashRedisClient';

describe('UpstashRedisClient', () => {
  let client!: UpstashRedisClient;
  let mockRedis!: Redis;

  beforeEach(() => {
    mockRedis = {
      zadd: vi.fn(),
      zrange: vi.fn(),
      set: vi.fn(),
      eval: vi.fn(),
    } as unknown as Redis;

    client = new UpstashRedisClient(mockRedis);
  });

  describe('zadd', () => {
    it('should call redis.zadd with correct parameters', async () => {
      vi.mocked(mockRedis.zadd).mockResolvedValue(1);

      const result = await client.zadd('test-key', 1234567890, 'member-value');

      expect(mockRedis.zadd).toHaveBeenCalledWith('test-key', {
        score: 1234567890,
        member: 'member-value',
      });
      expect(result).toBe(1);
    });

    it('should return 0 for non-number result', async () => {
      vi.mocked(mockRedis.zadd).mockResolvedValue(null as unknown as number);

      const result = await client.zadd('test-key', 123, 'member');

      expect(result).toBe(0);
    });
  });

  describe('zrangebyscore', () => {
    it('should call redis.zrange with byScore option', async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue(['member1', 'member2']);

      const result = await client.zrangebyscore('test-key', 100, 200);

      expect(mockRedis.zrange).toHaveBeenCalledWith('test-key', 100, 200, {
        byScore: true,
      });
      expect(result).toEqual(['member1', 'member2']);
    });

    it('should convert non-string values to strings', async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue([123, 456]);

      const result = await client.zrangebyscore('test-key', 0, 1000);

      expect(result).toEqual(['123', '456']);
    });

    it('should return empty array when no results', async () => {
      vi.mocked(mockRedis.zrange).mockResolvedValue([]);

      const result = await client.zrangebyscore('test-key', 0, 1000);

      expect(result).toEqual([]);
    });
  });

  describe('set', () => {
    it('should call redis.set with NX and EX options', async () => {
      vi.mocked(mockRedis.set).mockResolvedValue('OK');

      const result = await client.set('test-key', 'value', 'NX', 'EX', 3600);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'value', {
        nx: true,
        ex: 3600,
      });
      expect(result).toBe('OK');
    });

    it('should return null when key already exists', async () => {
      vi.mocked(mockRedis.set).mockResolvedValue(null);

      const result = await client.set('existing-key', 'value', 'NX', 'EX', 3600);

      expect(result).toBeNull();
    });
  });

  describe('eval', () => {
    it('should call redis.eval with script, keys, and args', async () => {
      vi.mocked(mockRedis.eval).mockResolvedValue([0, 8]);

      const result = await client.eval<[number, number]>('return {0, 8}', ['key-1'], [10, 5]);

      expect(mockRedis.eval).toHaveBeenCalledWith('return {0, 8}', ['key-1'], [10, 5]);
      expect(result).toEqual([0, 8]);
    });
  });

  describe('createUpstashRedisClient', () => {
    it('should create UpstashRedisClient instance', () => {
      const instance = createUpstashRedisClient(mockRedis);

      expect(instance).toBeInstanceOf(UpstashRedisClient);
    });
  });
});
