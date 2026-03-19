---
editUrl: false
next: false
prev: false
title: "RateLimitExceededProblem"
---

Defined in: [packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts#L8)

Problem thrown when rate limit is exceeded.
RFC 7807 compliant with rate limit extensions.

## Extends

- [`Problem`](/api/problems-core/src/classes/problem/)

## Constructors

### Constructor

> **new RateLimitExceededProblem**(`result`): `RateLimitExceededProblem`

Defined in: [packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts:14](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts#L14)

#### Parameters

##### result

[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)

#### Returns

`RateLimitExceededProblem`

#### Overrides

`Problem.constructor`

## Properties

### category

> `readonly` **category**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

Defined in: [packages/problems-core/src/libs/Problem.ts:23](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L23)

HTTP 의미론과 매핑되는 문제 카테고리입니다.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`category`](/api/problems-core/src/classes/problem/#category)

***

### cause?

> `readonly` `optional` **cause**: `Error`

Defined in: [packages/problems-core/src/libs/Problem.ts:28](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L28)

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`cause`](/api/problems-core/src/classes/problem/#cause)

***

### code

> `readonly` **code**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:22](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L22)

도메인에서 문제를 식별하는 고유 코드입니다.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`code`](/api/problems-core/src/classes/problem/#code)

***

### detail?

> `readonly` `optional` **detail**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L24)

문제의 상세 설명입니다.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`detail`](/api/problems-core/src/classes/problem/#detail)

***

### extensions?

> `readonly` `optional` **extensions**: `Record`\<`string`, `unknown`\>

Defined in: [packages/problems-core/src/libs/Problem.ts:27](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L27)

Problem Details 확장 필드입니다.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`extensions`](/api/problems-core/src/classes/problem/#extensions)

***

### instance?

> `readonly` `optional` **instance**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:26](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L26)

특정 에러 발생 인스턴스를 식별하는 URI입니다.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`instance`](/api/problems-core/src/classes/problem/#instance)

***

### message

> **message**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`message`](/api/problems-core/src/classes/problem/#message)

***

### name

> **name**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`name`](/api/problems-core/src/classes/problem/#name)

***

### retryAfterMs

> `readonly` **retryAfterMs**: `number`

Defined in: [packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts:12](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts#L12)

Time in milliseconds until the rate limit resets.

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`stack`](/api/problems-core/src/classes/problem/#stack)

***

### type

> `readonly` **type**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:25](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L25)

문제 유형 식별자 URI입니다.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`type`](/api/problems-core/src/classes/problem/#type)

***

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

Defined in: node\_modules/@types/node/globals.d.ts:68

The `Error.stackTraceLimit` property specifies the number of stack frames
collected by a stack trace (whether generated by `new Error().stack` or
`Error.captureStackTrace(obj)`).

The default value is `10` but may be set to any valid JavaScript number. Changes
will affect any stack trace captured _after_ the value has been changed.

If set to a non-number value, or set to a negative number, stack traces will
not capture any frames.

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`stackTraceLimit`](/api/problems-core/src/classes/problem/#stacktracelimit)

## Accessors

### retryAfterSeconds

#### Get Signature

> **get** **retryAfterSeconds**(): `number`

Defined in: [packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts:35](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/problems/RateLimitExceededProblem.ts#L35)

Get Retry-After header value in seconds.

##### Returns

`number`

***

### status

#### Get Signature

> **get** **status**(): `number`

Defined in: [packages/problems-core/src/libs/Problem.ts:70](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L70)

##### Returns

`number`

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`status`](/api/problems-core/src/classes/problem/#status)

***

### title

#### Get Signature

> **get** **title**(): `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:66](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L66)

##### Returns

`string`

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`title`](/api/problems-core/src/classes/problem/#title)

## Methods

### toJSON()

> **toJSON**(): [`ProblemDetails`](/api/problems-core/src/interfaces/problemdetails/)

Defined in: [packages/problems-core/src/libs/Problem.ts:74](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/problems-core/src/libs/Problem.ts#L74)

#### Returns

[`ProblemDetails`](/api/problems-core/src/interfaces/problemdetails/)

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`toJSON`](/api/problems-core/src/classes/problem/#tojson)

***

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node\_modules/@types/node/globals.d.ts:52

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack;  // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

#### Parameters

##### targetObject

`object`

##### constructorOpt?

`Function`

#### Returns

`void`

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`captureStackTrace`](/api/problems-core/src/classes/problem/#capturestacktrace)

***

### prepareStackTrace()

> `static` **prepareStackTrace**(`err`, `stackTraces`): `any`

Defined in: node\_modules/@types/node/globals.d.ts:56

#### Parameters

##### err

`Error`

##### stackTraces

`CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

[`Problem`](/api/problems-core/src/classes/problem/).[`prepareStackTrace`](/api/problems-core/src/classes/problem/#preparestacktrace)
