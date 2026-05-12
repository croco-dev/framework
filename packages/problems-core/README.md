# @croco/problems-core

RFC 7807 Problem Details 기반의 공통 에러 계층입니다. Croco 패키지 전반에서 일관된 HTTP 에러 표현을 만들 때 사용합니다.

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
