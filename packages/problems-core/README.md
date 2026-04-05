# @croco/problems-core

RFC 7807 Problem Details 기반의 타입 안전한 에러 처리 라이브러리입니다.

## 설치

```bash
pnpm add @croco/problems-core
```

## 사용법

### 기본 Problem 생성

```ts
import { Problem, ProblemCategory } from '@croco/problems-core';

class NotFoundProblem extends Problem {
  constructor(resource: string) {
    super('RESOURCE_NOT_FOUND', ProblemCategory.NotFound, `The requested ${resource} could not be found`);
  }
}

throw new NotFoundProblem('User');
```

### ProblemFactory 사용

```ts
import { ProblemFactory } from '@croco/problems-core';

const problem = ProblemFactory.notFound('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
console.log(problem.toJSON());
// {
//   type: 'about:blank',
//   title: 'Not Found',
//   status: 404,
//   detail: '사용자를 찾을 수 없습니다.',
//   code: 'USER_NOT_FOUND'
// }
```

### 확장 필드 사용

```ts
const problem = ProblemFactory.validationError('VALIDATION_FAILED', '입력값이 올바르지 않습니다.', {
  extensions: { errors: [{ field: 'email', message: '유효하지 않은 이메일입니다.' }] }
});
```

### ProblemCategory 매핑

```ts
import { ProblemCategoryMapper, ProblemCategory } from '@croco/problems-core';

const status = ProblemCategoryMapper.toHttpStatus(ProblemCategory.NotFound); // 404
const title = ProblemCategoryMapper.toTitle(ProblemCategory.NotFound); // 'Not Found'
```

### 직렬화/역직렬화

```ts
import { ProblemSerializer } from '@croco/problems-core';

const problem = ProblemFactory.notFound('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
const serialized = ProblemSerializer.serialize(problem.toJSON());
const deserialized = ProblemSerializer.deserialize(serialized);

// JSON 파싱
const json = { type: 'about:blank', title: 'Not Found', status: 404, code: 'NOT_FOUND' };
const details = ProblemSerializer.fromJson(json);
```

## API 요약

| API | 설명 |
|-----|------|
| `Problem` | RFC 7807 Problem Details 기반 추상 에러 클래스 |
| `ProblemCategory` | HTTP 의미론과 연결된 카테고리 열거형 |
| `ProblemCategoryMapper` | 카테고리 → HTTP 상태 코드/제목 매핑 |
| `ProblemFactory` | 카테고리별 Problem 인스턴스 생성 |
| `ProblemSerializer` | ProblemDetails 직렬화/역직렬화 |
| `HttpStatus` | HTTP 상태 코드 상수 |

## ProblemCategory별 HTTP 상태 코드

| Category | HTTP Status |
|----------|-------------|
| BadRequest | 400 |
| Unauthorized | 401 |
| Forbidden | 403 |
| NotFound | 404 |
| Conflict | 409 |
| Gone | 410 |
| ValidationError | 422 |
| BusinessRuleViolation | 422 |
| TooManyRequests | 429 |
| InternalServerError | 500 |
| NotImplemented | 501 |
