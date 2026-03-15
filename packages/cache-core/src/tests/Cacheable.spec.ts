import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cacheable } from '../libs/decorators/Cacheable';
import { CacheEvict } from '../libs/decorators/CacheEvict';
import { InMemoryCacheStore } from '../libs/InMemoryCacheStore';

describe('@Cacheable', () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  it('caches method result', async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: 'test-service' })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    const result1 = await service.getData('123');
    const result2 = await service.getData('123');

    expect(result1).toBe('data-123');
    expect(result2).toBe('data-123');
    expect(callCount).toBe(1);
  });

  it('uses different cache keys for different arguments', async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: 'test-service' })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    await service.getData('123');
    await service.getData('456');

    expect(callCount).toBe(2);
  });

  it('respects TTL', async () => {
    vi.useFakeTimers();
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, namespace: 'test-service', ttl: 1000 })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();

    await service.getData('123');
    vi.advanceTimersByTime(1001);
    await service.getData('123');

    expect(callCount).toBe(2);

    vi.useRealTimers();
  });

  it('uses custom key prefix', async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache, keyPrefix: 'custom:prefix' })
      async getData(id: string): Promise<string> {
        callCount++;
        return `data-${id}`;
      }
    }

    const service = new TestService();
    await service.getData('123');

    const cached = await cache.get('custom:prefix:["123"]');
    expect(cached).toBe('data-123');
  });

  it('preserves this context', async () => {
    class TestService {
      private prefix = 'result:';

      @Cacheable({ store: cache, namespace: 'test-service' })
      async getData(id: string): Promise<string> {
        return `${this.prefix}${id}`;
      }
    }

    const service = new TestService();
    const result = await service.getData('123');

    expect(result).toBe('result:123');
  });

  it('uses namespace for default cache keys', async () => {
    class TestService {
      @Cacheable({ store: cache, namespace: 'stable-service' })
      async getData(id: string): Promise<string> {
        return `data-${id}`;
      }
    }

    const service = new TestService();
    await service.getData('123');

    expect(await cache.get('stable-service:getData:["123"]')).toBe('data-123');
  });

  it('prefers keyPrefix over namespace', async () => {
    class TestService {
      @Cacheable({ store: cache, namespace: 'stable-service', keyPrefix: 'custom:prefix' })
      async getData(id: string): Promise<string> {
        return `data-${id}`;
      }
    }

    const service = new TestService();
    await service.getData('123');

    expect(await cache.get('custom:prefix:["123"]')).toBe('data-123');
    expect(await cache.get('stable-service:getData:["123"]')).toBeUndefined();
  });

  it('throws when neither namespace nor keyPrefix is provided', () => {
    expect(() => {
      class TestService {
        @Cacheable({ store: cache })
        async getData(id: string): Promise<string> {
          return `data-${id}`;
        }
      }

      return TestService;
    }).toThrow('@Cacheable requires "namespace" when "keyPrefix" is not provided (method: getData)');
  });
});

describe('@CacheEvict', () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  it('evicts cache by pattern after method execution', async () => {
    await cache.set('test-service:updateData:["123"]', 'cached');
    await cache.set('test-service:updateData:["456"]', 'cached2');
    await cache.set('OtherService:getData:["123"]', 'other');

    class TestService {
      @CacheEvict({ store: cache, namespace: 'test-service' })
      async updateData(_id: string): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData('123');

    expect(await cache.get('test-service:updateData:["123"]')).toBeUndefined();
    expect(await cache.get('test-service:updateData:["456"]')).toBeUndefined();
    expect(await cache.get('OtherService:getData:["123"]')).toBe('other');
  });

  it('evicts specific key', async () => {
    await cache.set('my-key', 'cached');
    await cache.set('other-key', 'other');

    class TestService {
      @CacheEvict({ store: cache, key: 'my-key' })
      async updateData(): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData();

    expect(await cache.get('my-key')).toBeUndefined();
    expect(await cache.get('other-key')).toBe('other');
  });

  it('evicts by pattern with wildcard', async () => {
    await cache.set('user:123', 'data1');
    await cache.set('user:456', 'data2');
    await cache.set('order:789', 'data3');

    class TestService {
      @CacheEvict({ store: cache, key: 'user:*' })
      async clearUserCache(): Promise<void> {}
    }

    const service = new TestService();
    await service.clearUserCache();

    expect(await cache.get('user:123')).toBeUndefined();
    expect(await cache.get('user:456')).toBeUndefined();
    expect(await cache.get('order:789')).toBe('data3');
  });

  it('clears all entries with allEntries option', async () => {
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    class TestService {
      @CacheEvict({ store: cache, allEntries: true })
      async clearAll(): Promise<void> {}
    }

    const service = new TestService();
    await service.clearAll();

    expect(await cache.get('key1')).toBeUndefined();
    expect(await cache.get('key2')).toBeUndefined();
  });

  it('uses namespace for default eviction patterns', async () => {
    await cache.set('stable-service:updateData:["123"]', 'cached');
    await cache.set('stable-service:updateData:["456"]', 'cached2');

    class TestService {
      @CacheEvict({ store: cache, namespace: 'stable-service' })
      async updateData(): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData();

    expect(await cache.get('stable-service:updateData:["123"]')).toBeUndefined();
    expect(await cache.get('stable-service:updateData:["456"]')).toBeUndefined();
  });

  it('throws when neither namespace nor key is provided', () => {
    expect(() => {
      class TestService {
        @CacheEvict({ store: cache })
        async updateData(): Promise<void> {}
      }

      return TestService;
    }).toThrow('@CacheEvict requires "namespace" when "key" is not provided (method: updateData)');
  });

  it('fails fast when namespace eviction is used with a store that does not support deleteByPattern', async () => {
    const unsupportedStore = {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      has: async () => false,
      clear: async () => undefined,
      deleteByPattern: undefined,
      pruneExpired: async () => 0,
    } as any;

    class TestService {
      @CacheEvict({ store: unsupportedStore, namespace: 'stable-service' })
      async updateData(): Promise<void> {}
    }

    const service = new TestService();

    await expect(service.updateData()).rejects.toThrow(
      'Cache store does not support deleteByPattern for namespace eviction: stable-service:updateData:*'
    );
  });

  it('fails fast when wildcard key eviction is used with a store that does not support deleteByPattern', async () => {
    const unsupportedStore = {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      has: async () => false,
      clear: async () => undefined,
      deleteByPattern: undefined,
      pruneExpired: async () => 0,
    } as any;

    class TestService {
      @CacheEvict({ store: unsupportedStore, key: 'user:*' })
      async clearUserCache(): Promise<void> {}
    }

    const service = new TestService();

    await expect(service.clearUserCache()).rejects.toThrow(
      'Cache store does not support deleteByPattern for wildcard eviction: user:*'
    );
  });

  it('executes method before evicting', async () => {
    let methodCalled = false;

    class TestService {
      @CacheEvict({ store: cache, key: 'test-key' })
      async updateData(): Promise<string> {
        methodCalled = true;
        return 'result';
      }
    }

    await cache.set('test-key', 'cached');

    const service = new TestService();
    const result = await service.updateData();

    expect(methodCalled).toBe(true);
    expect(result).toBe('result');
    expect(await cache.get('test-key')).toBeUndefined();
  });
});

describe('@Cacheable with @CacheEvict integration', () => {
  let cache!: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  it('evicts cache and refetches on next call', async () => {
    let fetchCount = 0;

    class UserService {
      @Cacheable({ store: cache, namespace: 'user-service' })
      async getUser(id: string): Promise<string> {
        fetchCount++;
        return `user-${id}`;
      }

      @CacheEvict({ store: cache, key: 'user-service:getUser:*' })
      async updateUser(_id: string): Promise<void> {}
    }

    const service = new UserService();

    await service.getUser('123');
    expect(fetchCount).toBe(1);

    await service.getUser('123');
    expect(fetchCount).toBe(1);

    await service.updateUser('123');

    await service.getUser('123');
    expect(fetchCount).toBe(2);
  });
});
