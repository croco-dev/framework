# @croco/search-meilisearch

Meilisearch를 `@croco/search-core` 검색 엔진 인터페이스에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/search-meilisearch meilisearch
```

## 사용법

```typescript
import { Context } from "@croco/framework-context";
import { MeilisearchEngine } from "@croco/search-meilisearch";

const engine = new MeilisearchEngine({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_API_KEY!,
  tenantTokenOptions: {
    apiKeyUid: "tenant-search",
    expiresIn: 3600,
  },
});

await Context.run({ requestId: "req-1", tenantId: "tenant-1" }, async () => {
  await engine.createIndex({
    name: "products",
    filterableFields: ["category"],
    searchableFields: ["name"],
  });
  await engine.indexDocument("products", {
    id: "p1",
    tenantId: "tenant-1",
    category: "apparel",
    name: "Croco Hoodie",
  });
  const result = await engine.search("products", {
    filters: { category: "apparel" },
    query: "hoodie",
  });
});
```

## API 레퍼런스

| API                                   | 설명                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| `MeilisearchEngine`                   | 검색, 인덱싱, 삭제, 인덱스 생성, tenant token 발급을 담당합니다. |
| `MeilisearchDiagnosticsProvider`      | 설정과 optional live readiness를 secret 없이 진단합니다.         |
| `MeilisearchEngineOptions`            | host, apiKey, tenant token, task 대기 옵션을 지정합니다.         |
| `TenantTokenOptions`                  | tenant token용 API key UID와 만료 시간을 지정합니다.             |
| `MissingMeilisearchConfigProblem`     | host/API key 설정 누락을 나타냅니다.                             |
| `MeilisearchInvalidRequestProblem`    | 안전하지 않은 필터/정렬 필드, 빈 index/document id를 나타냅니다. |
| `MeilisearchIndexNotFoundProblem`     | upstream index-not-found를 안정적인 Problem으로 정규화합니다.    |
| `MeilisearchRetryableUpstreamProblem` | timeout/429/5xx 등 재시도 가능한 upstream 장애를 나타냅니다.     |
| `MeilisearchTerminalUpstreamProblem`  | 인증 실패 등 terminal upstream 장애를 나타냅니다.                |
| `TenantTokenNotConfiguredProblem`     | tenant token 옵션 없이 토큰 발급을 시도할 때 발생합니다.         |

## 동작 메모

- 모든 검색과 인덱싱은 현재 `Context.getTenantId()` 값을 `_tenantId` 필드에 반영합니다.
- tenant token은 요청한 tenant가 현재 `Context.getTenantId()`와 일치할 때만 `_tenantId` 필터 규칙을 포함해 생성됩니다.
- tenant 정보가 없으면 `MissingTenantProblem`이 발생합니다.
- 모든 engine I/O 메서드는 `options.signal`을 Meilisearch 요청과 task polling에 전달합니다. 취소되면 SDK polling 간격을
  기다리지 않고 `search-core/operation-aborted` Problem으로 실패합니다.
- 검색, 결정적 문서 upsert·삭제, settings 갱신, task polling의 일시적 네트워크·429·5xx 실패는 최대 3회
  시도합니다. 기본 backoff는 `@croco/retry-core` 정책을 사용하며 `retryBackoff`로 조정할 수 있습니다.
  index 생성·삭제와 tenant token 발급은 재실행하지 않습니다.
- `createIndex`, `indexDocument`, `bulkIndex`, `deleteDocument`, `deleteIndex`는 기본적으로
  Meilisearch task 완료를 기다린 뒤 resolve합니다. 필요하면 `taskWait.enabled: false`로
  enqueue-only 동작을 선택할 수 있습니다.
- 필터와 정렬 필드는 `A-Z`, `a-z`, 숫자, `_`, `.`, `-`만 허용합니다. 문자열 필터 값은
  quote/backslash를 escape해 tenant filter injection을 막습니다.

## 런타임과 설정

| 항목                  | 값                                                             |
| --------------------- | -------------------------------------------------------------- |
| Runtime               | Node.js, Lambda                                                |
| Required env          | `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`                      |
| Optional tenant token | `tenantTokenOptions.apiKeyUid`, `tenantTokenOptions.expiresIn` |

`MeilisearchDiagnosticsProvider`는 설정 존재 여부만 boolean으로 노출하고 raw host/API key를
출력하지 않습니다. Live readiness는 명시적으로 `readinessCheck`를 넘겼을 때만 실행됩니다.

```typescript
import { MeilisearchDiagnosticsProvider } from "@croco/search-meilisearch";

const diagnostics = new MeilisearchDiagnosticsProvider(
  {
    host: process.env.MEILISEARCH_HOST,
    apiKey: process.env.MEILISEARCH_API_KEY,
  },
  {
    readinessCheck: async ({ client }) => {
      await client.health();
      return { details: { reachable: true } };
    },
  },
);

const health = await diagnostics.getHealth();
```

## 검증

Default tests do not require a live Meilisearch service:

```bash
pnpm --filter @croco/search-meilisearch test
```

Optional live smoke runs only when both env vars are present:

```bash
MEILISEARCH_HOST=http://localhost:7700 \
MEILISEARCH_API_KEY=masterKey \
pnpm --filter @croco/search-meilisearch test -- MeilisearchLiveSmoke
```
