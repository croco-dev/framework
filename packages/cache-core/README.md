# @croco/cache-core

Croco 프레임워크용 캐시 추상화 패키지입니다. 인메모리 LRU 캐시, stampede protection, TTL 관리, 패턴 무효화, 분산 캐시 인터페이스를 제공합니다.

## 설치

```bash
npm install @croco/cache-core
# 또는
pnpm add @croco/cache-core
```

## 기능

- **진정한 LRU**: 읽기 접근 시 순서를 갱신하는 eviction 정책
- **Stampede protection**: 동일 키 동시 요청을 singleflight로 병합
- **TTL(ms)**: lazy eviction + 주기적 정리 지원
- **통계 조회**: hit, miss, eviction, size 집계
- **고수준 API**: `getOrSet()`, `invalidatePattern()`, `warmup()`
- **분산 캐시 확장점**: 락 획득과 무효화 전파 인터페이스 제공

## 사용법

### InMemoryCacheStore

```typescript
import { InMemoryCacheStore } from '@croco/cache-core';

const cache = new InMemoryCacheStore<string>({
  maxEntries: 500,
  cleanupIntervalMs: 30_000,
});

await cache.set('user:1', 'active-user', 5_000);

const value = await cache.get('user:1');
const stats = cache.getStats();
```

### getOrSet으로 singleflight 로딩

```typescript
import { InMemoryCacheStore } from '@croco/cache-core';

const cache = new InMemoryCacheStore<{ id: string; name: string }>({ maxEntries: 1000 });

const user = await cache.getOrSet('user:42', async () => {
  return await userRepository.findById('42');
}, {
  ttlMs: 60_000,
});
```

### warmup과 패턴 무효화

```typescript
import { InMemoryCacheStore } from '@croco/cache-core';

const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });

await cache.warmup([
  { key: 'tenant:1:profile', value: 'ready', ttlMs: 10_000 },
  { key: 'tenant:1:settings', value: 'loaded' },
]);

await cache.invalidatePattern('tenant:1:*');
```

### 데코레이터 기반 캐싱

```typescript
import { Cacheable, CacheEvict, InMemoryCacheStore } from '@croco/cache-core';

const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });

class UserService {
  @Cacheable({ store: cache, namespace: 'user-service', ttl: 60_000 })
  async getUser(id: string): Promise<string> {
    return `user-${id}`;
  }

  @CacheEvict({ store: cache, key: 'user-service:getUser:*' })
  async updateUser(_id: string): Promise<void> {}
}
```

## API 요약

### 타입

| 타입 | 설명 |
|------|------|
| `Cache<K, V>` | 제네릭 캐시 계약 |
| `CacheStore<K, V>` | 하위 호환용 추상 베이스 |
| `CacheStats` | hit/miss/eviction/size 통계 |
| `CacheWarmupEntry<K, V>` | warmup 항목 |
| `DistributedCacheStore<K, V>` | 분산 캐시 확장 계약 |
| `DistributedCacheLock` | 분산 락 해제 핸들 |

### 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `get(key)` | 값 조회 및 LRU 갱신 |
| `set(key, value, ttlMs?)` | 값 저장 |
| `getOrSet(key, loader, options?)` | 캐시 미스 시 singleflight 로딩 |
| `invalidatePattern(pattern)` | 와일드카드 패턴 무효화 |
| `warmup(entries)` | 미리 캐시 적재 |
| `pruneExpired()` | 만료 항목 수동 정리 |
| `getStats()` | 통계 조회 |

## 라이선스

MIT
