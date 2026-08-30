# @croco/search-drizzle

`@croco/search-core`용 Drizzle 기반 PostgreSQL 검색 엔진입니다.

## 설치

```bash
pnpm add @croco/search-drizzle @croco/search-core drizzle-orm
```

## 사용법

```typescript
import { DrizzleSearchEngine, PgTrgmStrategy } from "@croco/search-drizzle";

const engine = new DrizzleSearchEngine(db, new PgTrgmStrategy({ threshold: 0.25 }));
const controller = new AbortController();

const result = await engine.search(
  "documents",
  {
    query: "croco framework",
    filters: { status: "published" },
    sort: [{ field: "published_at", order: "desc" }],
    limit: 20,
    offset: 0,
  },
  { signal: controller.signal },
);

await engine.indexDocument(
  "documents",
  {
    id: "doc-1",
    title: "Croco 소개",
    search_vector: "croco framework",
  },
  { signal: controller.signal },
);
```

전략별로 `pg_trgm`, `pg_search`, `pgroonga` 확장이 필요합니다.

애플리케이션이 소유한 각 PostgreSQL 검색 테이블은 `id`와 `tenant_id`를 `NOT NULL`로 선언하고
`UNIQUE ("tenant_id", "id")` 제약 또는 동등한 고유 인덱스를 제공해야 합니다. 세 전략의 `indexDocument()`는 이 복합
문서 식별자를 충돌 대상으로 사용해 같은 tenant의 재색인을 원자적으로 갱신하고, 다른 tenant의 동일한 `id`는 별도 행으로
유지합니다. 충돌 시 `id`와 `tenant_id`는 보존하고 호출이 제공한 나머지 문서 열을 최신 값으로 갱신합니다. 테이블과 열은
식별자로 인용되고 값은 SQL 파라미터로 전달되며, 문서의 `tenant_id` 필드는 활성 tenant 값으로 대체됩니다.

## API 레퍼런스

### `DrizzleSearchEngine`

- `search(index, query, options)`, 전략 SQL로 검색 결과를 반환합니다.
- `indexDocument(index, document, options)`, 문서를 인덱싱합니다.
- `deleteDocument(index, documentId, options)`, 문서를 삭제합니다.
- `bulkIndex(index, documents, options)`, 문서를 순차적으로 일괄 인덱싱합니다.
- `capabilities`, 현재 전략의 기능 정보를 반환합니다.

모든 I/O 메서드는 `options.signal`을 실행 전후에 확인합니다. 현재 Drizzle의 node-postgres 경계는 이미 전달된 쿼리를
중단할 signal을 받지 않으므로, 실행 중 취소되면 호출은 `search-core/operation-aborted` Problem으로 실패하지만 데이터베이스
부작용은 이미 완료됐을 수 있습니다.

### 전략

- `PgTrgmStrategy`, `pg_trgm` 기반 유사도 검색 전략입니다.
- `PgSearchStrategy`, `pg_search` 기반 전문 검색 전략입니다.
- `PGroongaStrategy`, `pgroonga` 기반 검색 전략입니다.

각 전략의 `buildSearchQuery()`는 동일한 검색 및 테넌트 조건으로 행 조회와 전체 건수 조회를 구성한
`SearchQueryPlan`을 반환합니다. `SearchResult.total`은 limit/offset 적용 전 전체 일치 건수이며, 결과 행이 없는 페이지에서도
유지됩니다.

세 전략은 `SearchQuery`의 문자열, 유한한 숫자, boolean 필터를 동등 비교로 적용하고, 요청한 정렬 뒤에 관련도와 문서
ID를 결정적 tie-breaker로 추가합니다. limit과 offset은 0 이상의 safe integer만 받으며 값과 페이지네이션은 SQL
파라미터로 전달됩니다. 테이블·필터·정렬 식별자는 PostgreSQL의 63바이트 ASCII 식별자 범위로 제한되고, 정렬 방향은
`asc` 또는 `desc`만 허용됩니다. `tenantId`와 `tenant_id` 필터는 활성 tenant와 일치해야 하며 실제 tenant 조건은 별도
필수 절로 항상 적용됩니다. 지원하지 않는 값이나 안전하지 않은 식별자는 `search-drizzle/invalid-query` Problem으로
실패합니다.

### 타입과 문제

- `DRIZZLE_TOKEN`, 검색 엔진용 Drizzle 주입 토큰입니다.
- `SearchStrategy`, 전략 구현 계약입니다.
- `SearchQueryPlan`, 결과 행 SQL과 전체 건수 SQL을 함께 표현하는 전략 결과 타입입니다.
- `SearchResultRow`, 검색 결과 행 타입입니다.
- `InvalidSearchRowProblem`, 검색 결과 행, 관련도 점수 또는 전체 건수 행이 유효하지 않을 때 던지는 문제입니다.
- `InvalidSearchQueryProblem`, 검색 옵션을 안전하게 SQL로 컴파일할 수 없을 때 던지는 문제입니다.
