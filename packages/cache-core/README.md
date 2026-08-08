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
- **Cache Invalidation Graph**: domain event와 cache key/tag 무효화 관계를 manifest와 check로 검증

`InMemoryCacheStore`의 `ttlMs`는 유한한 0 이상의 밀리초 값이어야 합니다. `undefined`는 만료 없음, `0`은 즉시 만료를
의미하며, 음수·`NaN`·무한대는 저장이나 loader 실행 전에 거부됩니다.

## 사용법

### InMemoryCacheStore

```typescript
import { InMemoryCacheStore } from "@croco/cache-core";

const cache = new InMemoryCacheStore<string>({
  maxEntries: 500,
  cleanupIntervalMs: 30_000,
});

await cache.set("user:1", "active-user", 5_000);

const value = await cache.get("user:1");
const stats = cache.getStats();
```

`maxEntries`는 1부터 `Number.MAX_SAFE_INTEGER` 사이의 정수여야 합니다. `cleanupIntervalMs`를 지정하면 Node.js가
clamp하지 않는 1부터 2,147,483,647 사이의 정수 밀리초여야 합니다. 잘못된 값은 정리 타이머를 만들기 전에
`InvalidCacheConfigurationProblem`으로 거부됩니다.

### getOrSet으로 singleflight 로딩

```typescript
import { InMemoryCacheStore } from "@croco/cache-core";

const cache = new InMemoryCacheStore<{ id: string; name: string }>({ maxEntries: 1000 });

const user = await cache.getOrSet(
  "user:42",
  async () => {
    return await userRepository.findById("42");
  },
  {
    ttlMs: 60_000,
  },
);
```

### warmup과 패턴 무효화

```typescript
import { InMemoryCacheStore } from "@croco/cache-core";

const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });

await cache.warmup([
  { key: "tenant:1:profile", value: "ready", ttlMs: 10_000 },
  { key: "tenant:1:settings", value: "loaded" },
]);

await cache.invalidatePattern("tenant:1:*");
```

### Event-driven Cache Invalidation Graph

```typescript
import {
  assertCacheInvalidationGraphValid,
  createCacheInvalidationManifest,
  createCacheStoreInvalidationAdapter,
  defineCacheInvalidationEvent,
  defineCacheInvalidationGraph,
  defineCacheInvalidationRule,
  defineCacheKey,
  invalidateCacheForEvent,
  invalidateCacheKey,
  InMemoryCacheStore,
} from "@croco/cache-core";

const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });

const graph = defineCacheInvalidationGraph({
  events: [defineCacheInvalidationEvent({ eventName: "user.updated" })],
  keys: [
    defineCacheKey({ id: "user-by-id", pattern: "user:*" }),
    defineCacheKey({ id: "user-list", key: "users:list" }),
  ],
  rules: [
    defineCacheInvalidationRule({
      eventName: "user.updated",
      invalidates: [invalidateCacheKey("user-by-id"), invalidateCacheKey("user-list")],
    }),
  ],
});

const manifest = assertCacheInvalidationGraphValid(createCacheInvalidationManifest(graph));

await invalidateCacheForEvent({
  adapter: createCacheStoreInvalidationAdapter(cache, { name: "memory-cache" }),
  event: { eventName: "user.updated" },
  manifest,
});
```

`createCacheInvalidationManifest()`는 선언된 event별로 어떤 cache key, pattern, tag가 무효화되는지
정렬된 manifest로 반환합니다. `assertCacheInvalidationGraphValid()`는 unknown event reference와
orphan cache key/tag rule을 `cache-core/invalidation-graph-invalid` Problem으로 실패시킵니다.
adapter capability manifest는 exact key, pattern, tag invalidation 지원 여부를 명시합니다.

### 데코레이터 기반 캐싱

```typescript
import { Cacheable, CacheEvict, InMemoryCacheStore } from "@croco/cache-core";

const cache = new InMemoryCacheStore<string>({ maxEntries: 1000 });

class UserService {
  @Cacheable({ store: cache, namespace: "user-service", ttl: 60_000 })
  async getUser(id: string): Promise<string> {
    return `user-${id}`;
  }

  @CacheEvict({ store: cache, key: "user-service:getUser:*" })
  async updateUser(_id: string): Promise<void> {}
}
```

## API 요약

### 타입

| 타입                          | 설명                            |
| ----------------------------- | ------------------------------- |
| `Cache<K, V>`                 | 제네릭 캐시 계약                |
| `CacheStore<K, V>`            | 하위 호환용 추상 베이스         |
| `CacheStats`                  | hit/miss/eviction/size 통계     |
| `CacheWarmupEntry<K, V>`      | warmup 항목                     |
| `DistributedCacheStore<K, V>` | 분산 캐시 확장 계약             |
| `DistributedCacheLock`        | 분산 락 해제 핸들               |
| `CacheInvalidationManifest`   | event → key/tag 무효화 graph    |
| `CacheInvalidationAdapter`    | adapter capability/runtime 계약 |

### 주요 메서드

| 메서드                                   | 설명                           |
| ---------------------------------------- | ------------------------------ |
| `get(key)`                               | 값 조회 및 LRU 갱신            |
| `set(key, value, ttlMs?)`                | 값 저장                        |
| `getOrSet(key, loader, options?)`        | 캐시 미스 시 singleflight 로딩 |
| `invalidatePattern(pattern)`             | 와일드카드 패턴 무효화         |
| `warmup(entries)`                        | 미리 캐시 적재                 |
| `pruneExpired()`                         | 만료 항목 수동 정리            |
| `getStats()`                             | 통계 조회                      |
| `createCacheInvalidationManifest(graph)` | cache invalidation graph 생성  |
| `invalidateCacheForEvent(options)`       | event 기준 cache 무효화 실행   |

## 라이선스

MIT
