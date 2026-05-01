---
editUrl: false
next: false
prev: false
title: "Problem"
---

RFC 7807 Problem Details를 표현하는 기본 추상 에러 클래스입니다.

## Extends

- `Error`

## Extended by

- [`CircularDependencyProblem`](/api/framework-context/src/classes/circulardependencyproblem/)
- [`MiddlewareProblem`](/api/framework-context/src/classes/middlewareproblem/)
- [`ShutdownTimeoutProblem`](/api/framework-context/src/classes/shutdowntimeoutproblem/)
- [`CircuitBreakerOpenProblem`](/api/retry-core/src/classes/circuitbreakeropenproblem/)
- [`DuplicateRecoverHandlerProblem`](/api/retry-core/src/classes/duplicaterecoverhandlerproblem/)
- [`RetryAbortedProblem`](/api/retry-core/src/classes/retryabortedproblem/)
- [`RetryExhaustedProblem`](/api/retry-core/src/classes/retryexhaustedproblem/)
- [`CircuitBreakerUnexpectedStateProblem`](/api/retry-core/src/classes/circuitbreakerunexpectedstateproblem/)
- [`DuplicateEventFieldProblem`](/api/events-core/src/classes/duplicateeventfieldproblem/)
- [`DuplicateEventNameProblem`](/api/events-core/src/classes/duplicateeventnameproblem/)
- [`EventAfterCommitRequiresActiveTransactionProblem`](/api/events-core/src/classes/eventaftercommitrequiresactivetransactionproblem/)
- [`EventBusNotSetProblem`](/api/events-core/src/classes/eventbusnotsetproblem/)
- [`EventDefinitionProblem`](/api/events-core/src/classes/eventdefinitionproblem/)
- [`EventDeserializationError`](/api/events-core/src/classes/eventdeserializationerror/)
- [`EventTransactionContextUnavailableProblem`](/api/events-core/src/classes/eventtransactioncontextunavailableproblem/)
- [`UnknownEventTypeProblem`](/api/events-core/src/classes/unknowneventtypeproblem/)
- [`BackpressureExceededProblem`](/api/events-inmemory/src/classes/backpressureexceededproblem/)
- [`ApiKeyCreationFailedProblem`](/api/auth-core/src/classes/apikeycreationfailedproblem/)
- [`ApiKeyExpiredProblem`](/api/auth-core/src/classes/apikeyexpiredproblem/)
- [`ApiKeyRevokedProblem`](/api/auth-core/src/classes/apikeyrevokedproblem/)
- [`ForbiddenProblem`](/api/auth-core/src/classes/forbiddenproblem/)
- [`InvalidPermissionActionProblem`](/api/auth-core/src/classes/invalidpermissionactionproblem/)
- [`InvalidPermissionFormatProblem`](/api/auth-core/src/classes/invalidpermissionformatproblem/)
- [`UnauthorizedProblem`](/api/auth-core/src/classes/unauthorizedproblem/)
- [`RateLimitKeyBuilderProblem`](/api/ratelimit-core/src/classes/ratelimitkeybuilderproblem/)
- [`RateLimitWindowProblem`](/api/ratelimit-core/src/classes/ratelimitwindowproblem/)
- [`RateLimitExceededProblem`](/api/ratelimit-core/src/classes/ratelimitexceededproblem/)
- [`AtomicQuotaNotSupportedProblem`](/api/metering-core/src/classes/atomicquotanotsupportedproblem/)
- [`DuplicateRecordProblem`](/api/metering-core/src/classes/duplicaterecordproblem/)
- [`InvalidMeterProblem`](/api/metering-core/src/classes/invalidmeterproblem/)
- [`QuotaExceededProblem`](/api/metering-core/src/classes/quotaexceededproblem/)
- [`RedisProblem`](/api/metering-core/src/classes/redisproblem/)
- [`OtlpEndpointRequiredProblem`](/api/telemetry-sdk-node/src/classes/otlpendpointrequiredproblem/)
- [`SamplerProblem`](/api/telemetry-sdk-node/src/classes/samplerproblem/)
- [`InvalidLlmPromptProblem`](/api/llm-core/src/classes/invalidllmpromptproblem/)
- [`InvalidLlmResponseProblem`](/api/llm-core/src/classes/invalidllmresponseproblem/)
- [`LlmProblem`](/api/llm-core/src/classes/llmproblem/)
- [`LlmProviderNotFoundProblem`](/api/llm-core/src/classes/llmprovidernotfoundproblem/)
- [`LlmRateLimitProblem`](/api/llm-core/src/classes/llmratelimitproblem/)
- [`LlmServiceNotInitializedProblem`](/api/llm-core/src/classes/llmservicenotinitializedproblem/)
- [`LlmTokenLimitExceededProblem`](/api/llm-core/src/classes/llmtokenlimitexceededproblem/)
- [`EmbeddingError`](/api/llm-core/src/classes/embeddingerror/)
- [`GenerationError`](/api/llm-core/src/classes/generationerror/)
- [`LlmServiceProblem`](/api/llm-core/src/classes/llmserviceproblem/)
- [`LlmStructuredOutputProblem`](/api/llm-core/src/classes/llmstructuredoutputproblem/)
- [`LlmToolExecutionProblem`](/api/llm-core/src/classes/llmtoolexecutionproblem/)
- [`ModelNotFoundError`](/api/llm-core/src/classes/modelnotfounderror/)

## Properties

### category

> `readonly` **category**: [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)

***

### cause?

> `readonly` `optional` **cause**: `Error`

#### Overrides

`Error.cause`

***

### code

> `readonly` **code**: `string`

***

### detail?

> `readonly` `optional` **detail**: `string`

***

### extensions?

> `readonly` `optional` **extensions**: [`ProblemExtensions`](/api/problems-core/src/type-aliases/problemextensions/)

***

### instance?

> `readonly` `optional` **instance**: `string`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack**: `string`

#### Inherited from

`Error.stack`

***

### type

> `readonly` **type**: `string`

***

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

The `Error.stackTraceLimit` property specifies the number of stack frames
collected by a stack trace (whether generated by `new Error().stack` or
`Error.captureStackTrace(obj)`).

The default value is `10` but may be set to any valid JavaScript number. Changes
will affect any stack trace captured _after_ the value has been changed.

If set to a non-number value, or set to a negative number, stack traces will
not capture any frames.

#### Inherited from

`Error.stackTraceLimit`

## Accessors

### status

#### Get Signature

> **get** **status**(): `number`

##### Returns

`number`

***

### title

#### Get Signature

> **get** **title**(): `string`

##### Returns

`string`

## Methods

### toJSON()

> **toJSON**(): [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

#### Returns

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

***

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

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

`Error.captureStackTrace`

***

### prepareStackTrace()

> `static` **prepareStackTrace**(`err`, `stackTraces`): `any`

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

`Error.prepareStackTrace`
