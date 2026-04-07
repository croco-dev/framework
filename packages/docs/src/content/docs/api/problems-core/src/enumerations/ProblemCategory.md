---
editUrl: false
next: false
prev: false
title: "ProblemCategory"
---

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L5)

RFC 7807 Problem Details와 HTTP 의미론을 연결하는 문제 카테고리 열거형입니다.
각 카테고리는 특정 HTTP 상태 코드와 제목에 매핑됩니다.

## Enumeration Members

### BadRequest

> **BadRequest**: `"BadRequest"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L7)

잘못된 요청 형식 또는 파라미터 문제를 나타냅니다. (400)

***

### BusinessRuleViolation

> **BusinessRuleViolation**: `"BusinessRuleViolation"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:21](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L21)

비즈니스 규칙 위반을 나타냅니다. (422)

***

### Conflict

> **Conflict**: `"Conflict"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:15](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L15)

리소스 충돌을 나타냅니다. (409)

***

### Forbidden

> **Forbidden**: `"Forbidden"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:11](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L11)

권한이 부족한 접근을 나타냅니다. (403)

***

### Gone

> **Gone**: `"Gone"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:17](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L17)

더 이상 사용되지 않는 리소스를 나타냅니다. (410)

***

### InternalServerError

> **InternalServerError**: `"InternalServerError"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L25)

서버 내부 오류를 나타냅니다. (500)

***

### NotFound

> **NotFound**: `"NotFound"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L13)

요청한 리소스를 찾을 수 없는 상태를 나타냅니다. (404)

***

### NotImplemented

> **NotImplemented**: `"NotImplemented"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:27](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L27)

구현되지 않은 기능을 나타냅니다. (501)

***

### TooManyRequests

> **TooManyRequests**: `"TooManyRequests"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:23](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L23)

요청 빈도 제한 초과를 나타냅니다. (429)

***

### Unauthorized

> **Unauthorized**: `"Unauthorized"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L9)

인증이 필요한 리소스에 대한 접근을 나타냅니다. (401)

***

### ValidationError

> **ValidationError**: `"ValidationError"`

Defined in: [packages/problems-core/src/libs/ProblemCategory.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/ProblemCategory.ts#L19)

입력 검증 실패를 나타냅니다. (422)
