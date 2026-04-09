# @croco/search-meilisearch

Meilisearch를 `@croco/search-core` 검색 엔진 인터페이스에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/search-meilisearch meilisearch
```

## 사용법

```typescript
import { MeilisearchEngine } from '@croco/search-meilisearch';

const engine = new MeilisearchEngine({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_API_KEY!,
  tenantTokenOptions: {
    apiKeyUid: 'tenant-search',
    expiresIn: 3600,
  },
});

await engine.indexDocument('products', { id: 'p1', name: 'Croco Hoodie' });
const result = await engine.search('products', { query: 'hoodie' });
```

## API 레퍼런스

| API | 설명 |
|---|---|
| `MeilisearchEngine` | 검색, 인덱싱, 삭제, 인덱스 생성, tenant token 발급을 담당합니다. |
| `MeilisearchEngineOptions` | host, apiKey, tenant token 옵션을 지정합니다. |
| `TenantTokenOptions` | tenant token용 API key UID와 만료 시간을 지정합니다. |
| `TenantTokenNotConfiguredProblem` | tenant token 옵션 없이 토큰 발급을 시도할 때 발생합니다. |

## 동작 메모

- 모든 검색과 인덱싱은 현재 `Context.getTenantId()` 값을 `_tenantId` 필드에 반영합니다.
- tenant token은 `_tenantId` 필터 규칙을 포함해 생성됩니다.
- tenant 정보가 없으면 `MissingTenantProblem`이 발생합니다.
