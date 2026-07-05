# @croco/problems-core

RFC 7807 Problem Details 기반의 공통 에러 계층입니다. Croco 패키지 전반에서 일관된 HTTP 에러 표현을 만들 때 사용합니다.
Croco 전체 실패 분류 기준은 [Failure Semantics](../../packages/docs/src/content/docs/en/guides/failure-semantics.mdx)를 따릅니다.

## 설치

```bash
pnpm add @croco/problems-core
```

## 사용법

### Problem 서브클래스 정의

```typescript
import { Problem, ProblemCategory } from "@croco/problems-core";

class UserNotFoundProblem extends Problem {
  constructor(userId: string) {
    super("user/not-found", ProblemCategory.NotFound, `사용자 '${userId}'를 찾을 수 없습니다.`);
  }
}
```

### ProblemFactory 사용

```typescript
import { ProblemFactory } from "@croco/problems-core";

throw ProblemFactory.validationError("user/invalid-email", "이메일 형식이 올바르지 않습니다.");
```

### 직렬화

```typescript
import { ProblemSerializer } from "@croco/problems-core";

const json = ProblemSerializer.serialize(
  ProblemFactory.notFound("user/not-found", "사용자를 찾을 수 없습니다.").toJSON(),
);
```

## API 레퍼런스

- `Problem`: 모든 Problem 서브클래스의 기반 추상 클래스
- `ProblemCategory`: HTTP 의미에 맞춘 카테고리 열거형
- `ProblemCategoryMapper`, `toHttpStatus`, `toTitle`: 카테고리 매핑 유틸리티
- `ProblemFactory`: 자주 쓰는 Problem 인스턴스 생성기
- `ProblemSerializer`: 직렬화와 역직렬화
- `HttpStatus`: 상태 코드 상수
- `ProblemExtensions`, `validateExtensions`, `isValidExtensions`: 확장 필드 검증

## 실패 의미론

`ProblemCategory`는 HTTP 상태 코드뿐 아니라 호출자가 선택할 복구 경로를 나타냅니다. `BadRequest`, `ValidationError`, `BusinessRuleViolation`, `Conflict`, `Unauthorized`, `Forbidden`, `NotFound`, `Gone`, `NotImplemented`는 기본적으로 terminal 실패이며, `TooManyRequests`와 `InternalServerError`는 `retry-core`에서 기본 재시도 대상으로 소비됩니다.

`code`는 패키지별 안정 식별자입니다. 새 public Problem은 기존 패키지 관례를 따르되 요청 id, tenant id, provider trace id, provider message처럼 매 요청 달라지는 값을 code에 넣지 않습니다. 외부 provider 오류를 정규화할 때는 안전한 `cause` 또는 extension으로 원인 증거를 남기고 secret, credential, raw body는 노출하지 않습니다.

HTTP response 직렬화는 `Problem.extensions` 전체를 public surface로 취급하지 않습니다. transport는 등록된
Problem code의 `recovery.redactionPolicy`를 우선 적용하고, 등록되지 않은 code는 `ProblemCategory`
기본 redaction policy를 사용합니다. `public`과 `safe-message`는 명시적인 public extension
allowlist만 노출하고, `operator-only`는 detail과 extension을 모두 opaque하게 만듭니다.
운영자 진단은 로그, trace, `requestId`/`traceId` correlation metadata로 연결하고, 응답에 필요한
사용자 복구 정보만 stable한 public extension key로 모델링합니다.
