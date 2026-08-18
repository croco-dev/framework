---
editUrl: false
next: false
prev: false
title: "ErrorHandler"
---

HTTP 애플리케이션 구성과 라우트 실행에 사용하는 핵심 공개 API입니다.

## Constructors

### Constructor

> **new ErrorHandler**(`logger`): `ErrorHandler`

#### Parameters

##### logger

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`ErrorHandler`

## Methods

### createFilterResponseBody()

> **createFilterResponseBody**(`error`, `body`, `ctx`): `Record`\<`string`, `unknown`\>

#### Parameters

##### error

`unknown`

##### body

`Record`\<`string`, `unknown`\>

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Record`\<`string`, `unknown`\>

---

### createProblemResponseBody()

> **createProblemResponseBody**(`problem`, `ctx`): [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

#### Parameters

##### problem

[`Problem`](/api/problems-core/src/classes/problem/)

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

---

### handleError()

> **handleError**(`error`, `ctx`): `Response`

#### Parameters

##### error

`unknown`

##### ctx

[`CrocoHttpContext`](/api/transports-http/src/interfaces/crocohttpcontext/)

#### Returns

`Response`
