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
    limit: 20,
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

### 타입과 문제

- `DRIZZLE_TOKEN`, 검색 엔진용 Drizzle 주입 토큰입니다.
- `SearchStrategy`, 전략 구현 계약입니다.
- `SearchResultRow`, 검색 결과 행 타입입니다.
- `InvalidSearchRowProblem`, 검색 결과가 객체가 아닐 때 던지는 문제입니다.
