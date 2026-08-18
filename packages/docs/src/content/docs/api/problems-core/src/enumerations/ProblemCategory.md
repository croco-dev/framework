---
editUrl: false
next: false
prev: false
title: "ProblemCategory"
---

RFC 7807 Problem Details와 HTTP 의미론을 연결하는 문제 카테고리 열거형입니다.
각 카테고리는 특정 HTTP 상태 코드와 제목에 매핑됩니다.

## Enumeration Members

### BadRequest

> **BadRequest**: `"BadRequest"`

잘못된 요청 형식 또는 파라미터 문제를 나타냅니다. (400)

***

### BusinessRuleViolation

> **BusinessRuleViolation**: `"BusinessRuleViolation"`

비즈니스 규칙 위반을 나타냅니다. (422)

***

### Conflict

> **Conflict**: `"Conflict"`

리소스 충돌을 나타냅니다. (409)

***

### Forbidden

> **Forbidden**: `"Forbidden"`

권한이 부족한 접근을 나타냅니다. (403)

***

### Gone

> **Gone**: `"Gone"`

더 이상 사용되지 않는 리소스를 나타냅니다. (410)

***

### InternalServerError

> **InternalServerError**: `"InternalServerError"`

서버 내부 오류를 나타냅니다. (500)

***

### NotFound

> **NotFound**: `"NotFound"`

요청한 리소스를 찾을 수 없는 상태를 나타냅니다. (404)

***

### NotImplemented

> **NotImplemented**: `"NotImplemented"`

구현되지 않은 기능을 나타냅니다. (501)

***

### PayloadTooLarge

> **PayloadTooLarge**: `"PayloadTooLarge"`

요청 본문이 허용된 크기를 초과한 상태를 나타냅니다. (413)

***

### TooManyRequests

> **TooManyRequests**: `"TooManyRequests"`

요청 빈도 제한 초과를 나타냅니다. (429)

***

### Unauthorized

> **Unauthorized**: `"Unauthorized"`

인증이 필요한 리소스에 대한 접근을 나타냅니다. (401)

***

### ValidationError

> **ValidationError**: `"ValidationError"`

입력 검증 실패를 나타냅니다. (422)
