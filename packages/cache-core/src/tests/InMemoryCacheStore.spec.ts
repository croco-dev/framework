import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCacheStore } from '../libs/InMemoryCacheStore';

describe('InMemoryCacheStore', () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  describe('get and set', () => {
    it('stores and retrieves a value', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('returns undefined for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('overwrites existing value', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      const result = await cache.get('key1');
      expect(result).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    it('returns undefined after TTL expires', async () => {
      vi.useFakeTimers();

      await cache.set('key1', 'value1', 1000);

      let result = await cache.get('key1');
      expect(result).toBe('value1');

      vi.advanceTimersByTime(1001);

      result = await cache.get('key1');
      expect(result).toBeUndefined();

      vi.useRealTimers();
    });

    it('returns true for has() before expiration', async () => {
      vi.useFakeTimers();

      await cache.set('key1', 'value1', 1000);

      let exists = await cache.has('key1');
      expect(exists).toBe(true);

      vi.advanceTimersByTime(1001);

      exists = await cache.has('key1');
      expect(exists).toBe(false);

      vi.useRealTimers();
    });

    it('does not expire when TTL is not set', async () => {
      vi.useFakeTimers();

      await cache.set('key1', 'value1');

      vi.advanceTimersByTime(10000);

      const result = await cache.get('key1');
      expect(result).toBe('value1');

      vi.useRealTimers();
    });
  });

  describe('delete', () => {
    it('removes a key', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const result = await cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('does not throw for non-existent key', async () => {
      await expect(cache.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('has', () => {
    it('returns true for existing key', async () => {
      await cache.set('key1', 'value1');
      const exists = await cache.has('key1');
      expect(exists).toBe(true);
    });

    it('returns false for non-existent key', async () => {
      const exists = await cache.has('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('deleteByPattern', () => {
    it('deletes keys matching prefix pattern', async () => {
      await cache.set('User:getUser:123', 'user1');
      await cache.set('User:getUser:456', 'user2');
      await cache.set('Order:getOrder:789', 'order1');

      const deleted = await cache.deleteByPattern('User:getUser:*');

      expect(deleted).toBe(2);
      expect(await cache.get('User:getUser:123')).toBeUndefined();
      expect(await cache.get('User:getUser:456')).toBeUndefined();
      expect(await cache.get('Order:getOrder:789')).toBe('order1');
    });

    it('deletes exact match when no wildcard', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const deleted = await cache.deleteByPattern('key1');

      expect(deleted).toBe(1);
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBe('value2');
    });

    it('returns 0 when no keys match', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.deleteByPattern('nonexistent*');
      expect(deleted).toBe(0);
    });
  });

  describe('pruneExpired', () => {
    it('removes expired entries without reads', async () => {
      vi.useFakeTimers();

      await cache.set('expired', 'value', 1000);
      await cache.set('active', 'value', 5000);

      vi.advanceTimersByTime(1001);

      const deleted = await cache.pruneExpired();

      expect(deleted).toBe(1);
      expect(await cache.get('expired')).toBeUndefined();
      expect(await cache.get('active')).toBe('value');

      vi.useRealTimers();
    });
  });

  describe('capacity management', () => {
    it('should apply default maxEntries of 1000 when not set', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      const defaultCache = new InMemoryCacheStore<string>();

      expect(warnSpy).toHaveBeenCalledWith(
        '[InMemoryCacheStore] maxEntries not set, using default 1000. Set maxEntries to control memory usage.'
      );

      for (let i = 0; i < 1001; i++) {
        await defaultCache.set(`key${i}`, `value${i}`);
      }

      expect(await defaultCache.get('key0')).toBeUndefined();
      expect(await defaultCache.get('key1000')).toBe('value1000');

      warnSpy.mockRestore();
    });

    it('should not warn when maxEntries is explicitly set', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should evict the oldest entry when maxEntries is exceeded', async () => {
      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      await boundedCache.set('key1', 'value1');
      await boundedCache.set('key2', 'value2');
      await boundedCache.set('key3', 'value3');

      expect(await boundedCache.get('key1')).toBeUndefined();
      expect(await boundedCache.get('key2')).toBe('value2');
      expect(await boundedCache.get('key3')).toBe('value3');
    });

    it('should prune expired entries before evicting active ones on set', async () => {
      vi.useFakeTimers();

      const boundedCache = new InMemoryCacheStore<string>({ maxEntries: 2 });

      await boundedCache.set('expired', 'value1', 1000);
      await boundedCache.set('active', 'value2');

      vi.advanceTimersByTime(1001);

      await boundedCache.set('fresh', 'value3');

      expect(await boundedCache.get('expired')).toBeUndefined();
      expect(await boundedCache.get('active')).toBe('value2');
      expect(await boundedCache.get('fresh')).toBe('value3');

      vi.useRealTimers();
    });
  });
});
