---
editUrl: false
next: false
prev: false
title: "ProblemFactory"
---

> `const` **ProblemFactory**: `object`

카테고리별 Problem 인스턴스를 생성하는 팩토리입니다.
각 메서드는 해당 카테고리에 맞는 HTTP 상태 코드와 함께 Problem 인스턴스를 생성합니다.

## Type Declaration

### badRequest()

> **badRequest**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

BadRequest (400) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### businessRuleViolation()

> **businessRuleViolation**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

BusinessRuleViolation (422) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### conflict()

> **conflict**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

Conflict (409) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### forbidden()

> **forbidden**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

Forbidden (403) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### gone()

> **gone**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

Gone (410) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### internalServerError()

> **internalServerError**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

InternalServerError (500) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### invalidArgument()

> **invalidArgument**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

InvalidArgument (400) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### notFound()

> **notFound**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

NotFound (404) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### notImplemented()

> **notImplemented**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

NotImplemented (501) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### payloadTooLarge()

> **payloadTooLarge**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

PayloadTooLarge (413) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### tooManyRequests()

> **tooManyRequests**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

TooManyRequests (429) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### unauthorized()

> **unauthorized**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

Unauthorized (401) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스

### validationError()

> **validationError**(`code`, `detail?`, `options?`): [`Problem`](/api/problems-core/src/classes/problem/)

ValidationError (422) 카테고리의 Problem을 생성합니다.

#### Parameters

##### code

`string`

도메인에서 문제를 식별하는 고유 코드

##### detail?

`string`

문제의 상세 설명

##### options?

[`ProblemOptions`](/api/problems-core/src/type-aliases/problemoptions/)

RFC 7807 필드 확장을 위한 옵션

#### Returns

[`Problem`](/api/problems-core/src/classes/problem/)

Problem 인스턴스
