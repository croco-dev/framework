import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cacheable } from '../libs/decorators/Cacheable';
import { CacheEvict } from '../libs/decorators/CacheEvict';
import { InMemoryCacheStore } from '../libs/InMemoryCacheStore';

describe('@Cacheable', () => {
  let cache: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  it('caches method result', async () => {
    let callCount = 0;

    class TestService {
      @Cacheable({ store: cache })
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
      @Cacheable({ store: cache })
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
      @Cacheable({ store: cache, ttl: 1000 })
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

      @Cacheable({ store: cache })
      async getData(id: string): Promise<string> {
        return `${this.prefix}${id}`;
      }
    }

    const service = new TestService();
    const result = await service.getData('123');

    expect(result).toBe('result:123');
  });
});

describe('@CacheEvict', () => {
  let cache: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  it('evicts cache by pattern after method execution', async () => {
    await cache.set('TestService:updateData:["123"]', 'cached');
    await cache.set('TestService:updateData:["456"]', 'cached2');
    await cache.set('OtherService:getData:["123"]', 'other');

    class TestService {
      @CacheEvict({ store: cache })
      async updateData(id: string): Promise<void> {}
    }

    const service = new TestService();
    await service.updateData('123');

    expect(await cache.get('TestService:updateData:["123"]')).toBeUndefined();
    expect(await cache.get('TestService:updateData:["456"]')).toBeUndefined();
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
  let cache: InMemoryCacheStore<string>;

  beforeEach(() => {
    cache = new InMemoryCacheStore<string>();
  });

  it('evicts cache and refetches on next call', async () => {
    let fetchCount = 0;

    class UserService {
      @Cacheable({ store: cache })
      async getUser(id: string): Promise<string> {
        fetchCount++;
        return `user-${id}`;
      }

      @CacheEvict({ store: cache, key: 'UserService:getUser:*' })
      async updateUser(id: string): Promise<void> {}
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
