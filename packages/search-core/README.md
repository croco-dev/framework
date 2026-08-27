# @croco/search-core

검색 메타데이터, 엔진 추상화, 자동 동기화, 한국어 텍스트 변환을 제공하는 검색 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/search-core @croco/events-core
```

## 사용법

```ts
import { defineSearchIndex, SearchField, SearchService, Searchable } from "@croco/search-core";

type UserDocument = {
  id: string;
  tenantId: string;
  name: string;
  status: "active" | "archived";
  createdAt: number;
};

const USERS = defineSearchIndex<UserDocument>()({
  name: "users",
  searchableFields: ["name"],
  filterableFields: ["status"],
  sortableFields: ["createdAt"],
});

@Searchable({ index: "users", autoSync: true })
class UserModel {
  @SearchField({ searchable: true, filterable: true })
  name!: string;
}

const searchService = new SearchService({ engine: searchEngine });
const controller = new AbortController();
const result = await searchService.search(
  USERS,
  {
    query: "홍길동",
    filters: { status: "active" },
    sort: [{ field: "createdAt", order: "desc" }],
  },
  { signal: controller.signal },
);
// result.hits[number].document는 UserDocument로 추론됩니다.
```

typed index를 점진적으로 도입하는 동안 기존 `searchService.search("users", query)`와
`searchEngine.search("users", query)` string 경로도 그대로 사용할 수 있습니다. `SearchEngine.searchIndex(USERS,
query)`, `SearchEngine.indexDocumentAt(USERS, document)`, `SearchEngine.bulkIndexAt(USERS, documents)`는 typed ref를
기존 adapter의 string index 이름으로 변환합니다. typed index의 필드 선언은 readonly이며 일반 interface 문서 타입을
지원합니다. 문자열 index signature가 있는 동적 문서는 기존 string 경로를 사용합니다.

```ts
import { InMemorySearchTransformRegistry, derive } from "@croco/search-core";
import { KoreanChosungAdapter } from "@croco/search-core/ko";

const transforms = new InMemorySearchTransformRegistry();
const initials = transforms.register(new KoreanChosungAdapter());
const derived = derive(initials, { options: { locale: "ko" } });
const chosung = transforms.apply(initials, "크로코 프레임워크", { locale: "ko" });
void derived;
void chosung;
```

`register()`가 반환하는 opaque ref는 adapter의 option 타입과 런타임 등록을 함께 보존합니다. 같은 adapter
인스턴스의 재등록은 같은 ref를 반환하고, 같은 ID를 가진 다른 adapter는
`SearchTransformRegistrationConflictProblem`으로 거부합니다.
`textTransforms`의 사전 정의는 `derive()`에서만 사용하며, `apply()`에는 반드시 `register()`가 반환한 ref를
전달합니다.

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

- `SearchIndexRef`, `SearchIndexQuery`, `SearchIndexDocument`, `SearchIndexDocumentInput`
- `SearchQuery`, `SearchResult`, `SearchHit`, `SearchDocument`, `SearchOperationOptions`
- `IndexConfig`, `SearchFieldConfig`, `SearchDerivedFieldConfig`, `SearchEngineCapabilities`
- `SearchableOptions`, `SearchFieldOptions`, `DeriveOptions`, `SearchTransformRef`

### 이벤트와 문제 타입

- 이벤트: `DocumentIndexedEvent`, `DocumentDeletedEvent`, `SearchSyncFailedEvent`
- 문제 타입: `SearchOperationAbortedProblem`, `MissingTenantProblem`, `SearchSyncIdentityConflictProblem`, `IndexNotFoundProblem`, `StrategyUnavailableProblem`, `TransformNotFoundProblem`, `SearchTransformRegistrationConflictProblem`, `SearchCapabilityUnavailableProblem`

## 구현 포인트

- 검색 엔진은 tenantId 기반 격리를 기본으로 가정합니다.
- `SearchEngine`과 `SearchService`의 모든 I/O 메서드는 `SearchOperationOptions.signal`을 동일한 호출의 provider
  작업에 전달합니다. 이미 취소된 호출은 `search-core/operation-aborted` Problem으로 provider I/O 전에 실패합니다.
- `autoSync`를 사용하면 이벤트 기반으로 인덱스 갱신을 자동화할 수 있습니다.
- `./ko` 서브패스로 한국어 전용 초성, 자모 변환 도구를 별도 import 할 수 있습니다.

### SearchAutoSync 실패 이벤트 계약

`SearchAutoSync`는 이벤트의 `tenantId`와 `documentId`를 동기화 작업의 authoritative identity로 사용합니다. 검색
어댑터 호출은 이벤트 tenant의 `Context`에서 실행하며, 기존 Context tenant가 다르거나 payload의 `id` 또는
`tenantId`가 이벤트와 충돌하면 `search-core/sync-identity-conflict` Problem으로 실패 이벤트를 발행합니다. 같은
값의 reserved field는 허용하지만 실제 어댑터 입력에는 이벤트 envelope의 값이 적용됩니다.

`SearchAutoSync`는 검색 인덱싱 또는 삭제 실패를 `SearchSyncFailedEvent`로 발행합니다. 이 실패 이벤트 발행은
best-effort 계약입니다. `failedEventPublisher.publishNow()`가 reject되어도 `handle()`은 publisher 오류를 호출자에게
전파하지 않고 완료됩니다.

성공한 동기화만 중복 처리 캐시에 기록합니다. 실패한 이벤트는 이후 delivery에서 다시 시도할 수 있으며, 같은
이벤트가 동시에 전달되면 진행 중인 작업을 공유하여 중복 어댑터 호출을 방지합니다.

대신 운영 신호는 `LOGGER_TOKEN` 로거의 `error()` 호출로 남깁니다. 로그 컨텍스트의 `searchSyncFailedEvent`에는
`eventName`, `indexName`, `documentId`, `tenantId`, `operation`, `syncErrorName`, `syncErrorMessage`가 포함됩니다.
초기 부트스트랩처럼 로거를 조회할 수 없는 경우에만 같은 컨텍스트와 publisher 오류를 `console.error`로 남깁니다.
