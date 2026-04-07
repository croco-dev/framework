---
editUrl: false
next: false
prev: false
title: "Problem"
---

Defined in: [packages/problems-core/src/libs/Problem.ts:21](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L21)

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
- [`DuplicateEventFieldProblem`](/api/events-core/src/classes/duplicateeventfieldproblem/)
- [`DuplicateEventNameProblem`](/api/events-core/src/classes/duplicateeventnameproblem/)
- [`EventAfterCommitRequiresActiveTransactionProblem`](/api/events-core/src/classes/eventaftercommitrequiresactivetransactionproblem/)
- [`EventBusNotSetProblem`](/api/events-core/src/classes/eventbusnotsetproblem/)
- [`EventDefinitionProblem`](/api/events-core/src/classes/eventdefinitionproblem/)
- [`EventDeserializationError`](/api/events-core/src/classes/eventdeserializationerror/)
- [`EventTransactionContextUnavailableProblem`](/api/events-core/src/classes/eventtransactioncontextunavailableproblem/)
- [`UnknownEventTypeProblem`](/api/events-core/src/classes/unknowneventtypeproblem/)
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

Defined in: [packages/problems-core/src/libs/Problem.ts:23](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L23)

***

### cause?

> `readonly` `optional` **cause**: `Error`

Defined in: [packages/problems-core/src/libs/Problem.ts:28](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L28)

#### Overrides

`Error.cause`

***

### code

> `readonly` **code**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:22](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L22)

***

### detail?

> `readonly` `optional` **detail**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:24](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L24)

***

### extensions?

> `readonly` `optional` **extensions**: [`ProblemExtensions`](/api/problems-core/src/type-aliases/problemextensions/)

Defined in: [packages/problems-core/src/libs/Problem.ts:27](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L27)

***

### instance?

> `readonly` `optional` **instance**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:26](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L26)

***

### message

> **message**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

***

### type

> `readonly` **type**: `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L25)

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

`Error.stackTraceLimit`

## Accessors

### status

#### Get Signature

> **get** **status**(): `number`

Defined in: [packages/problems-core/src/libs/Problem.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L62)

##### Returns

`number`

***

### title

#### Get Signature

> **get** **title**(): `string`

Defined in: [packages/problems-core/src/libs/Problem.ts:58](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L58)

##### Returns

`string`

## Methods

### toJSON()

> **toJSON**(): [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

Defined in: [packages/problems-core/src/libs/Problem.ts:66](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/problems-core/src/libs/Problem.ts#L66)

#### Returns

[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)

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

`Error.captureStackTrace`

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

`Error.prepareStackTrace`
