# @croco/search-core

검색 메타데이터, 엔진 추상화, 자동 동기화, 한국어 텍스트 변환을 제공하는 검색 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/search-core @croco/events-core
```

## 사용법

```ts
import { SearchField, SearchService, Searchable } from "@croco/search-core";

@Searchable({ index: "users", autoSync: true })
class UserDocument {
  @SearchField({ searchable: true, filterable: true })
  name!: string;
}

const searchService = new SearchService({ engine: searchEngine });
const result = await searchService.search("users", { query: "홍길동" });
```

```ts
import { derive, textTransforms } from "@croco/search-core";

const derived = derive({ type: "ngram", source: "name", options: { min: 2, max: 3 } });
const chosung = textTransforms.initials("크로코 프레임워크");
void derived;
void chosung;
```

## API 레퍼런스

### 핵심 클래스

- `SearchEngine`, 검색 엔진 구현이 따라야 하는 추상 계약입니다.
- `SearchService`, 현재 tenantId를 자동 주입하는 상위 검색 서비스입니다.
- `SearchAutoSync`, 인덱스 변경 이벤트를 받아 검색 엔진과 동기화합니다.
- `SearchTransformRegistry`, `InMemorySearchTransformRegistry`, 텍스트 변환 어댑터를 관리합니다.

### 데코레이터와 변환 도구

- `@Searchable`, 문서를 검색 인덱스에 연결합니다.
- `@SearchField`, 필드별 검색 옵션을 선언합니다.
- `derive`, 파생 필드 구성을 생성합니다.
- `textTransforms`, ngram, 자모 분해, 초성, 로마자 변환 유틸리티입니다.

### 주요 타입

- `SearchQuery`, `SearchResult`, `SearchHit`, `SearchDocument`
- `IndexConfig`, `SearchFieldConfig`, `SearchDerivedFieldConfig`, `SearchEngineCapabilities`
- `SearchableOptions`, `SearchFieldOptions`, `DeriveOptions`, `SearchTransformRef`

### 이벤트와 문제 타입

- 이벤트: `DocumentIndexedEvent`, `DocumentDeletedEvent`, `SearchSyncFailedEvent`
- 문제 타입: `MissingTenantProblem`, `IndexNotFoundProblem`, `StrategyUnavailableProblem`, `TransformNotFoundProblem`, `SearchCapabilityUnavailableProblem`

## 구현 포인트

- 검색 엔진은 tenantId 기반 격리를 기본으로 가정합니다.
- `autoSync`를 사용하면 이벤트 기반으로 인덱스 갱신을 자동화할 수 있습니다.
- `./ko` 서브패스로 한국어 전용 초성, 자모 변환 도구를 별도 import 할 수 있습니다.
