---
editUrl: false
next: false
prev: false
title: "RetryContext"
---

Defined in: [packages/retry-core/src/libs/RetryContext.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L5)

Context object passed to retry operations and listeners.
Tracks retry state across attempts.

## Constructors

### Constructor

> **new RetryContext**(`methodName`, `args`, `maxAttempts`): `RetryContext`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L12)

#### Parameters

##### methodName

`string`

##### args

`unknown`[]

##### maxAttempts

`number`

#### Returns

`RetryContext`

## Properties

### args

> `readonly` **args**: `unknown`[]

Defined in: [packages/retry-core/src/libs/RetryContext.ts:14](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L14)

***

### maxAttempts

> `readonly` **maxAttempts**: `number`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:15](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L15)

***

### methodName

> `readonly` **methodName**: `string`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L13)

## Accessors

### attempt

#### Get Signature

> **get** **attempt**(): `number`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L20)

##### Returns

`number`

***

### elapsedTimeMs

#### Get Signature

> **get** **elapsedTimeMs**(): `number`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L28)

##### Returns

`number`

***

### exhausted

#### Get Signature

> **get** **exhausted**(): `boolean`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:36](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L36)

##### Returns

`boolean`

***

### lastError

#### Get Signature

> **get** **lastError**(): `Error` \| `null`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L32)

##### Returns

`Error` \| `null`

***

### remainingAttempts

#### Get Signature

> **get** **remainingAttempts**(): `number`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:24](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L24)

##### Returns

`number`

## Methods

### getAttribute()

> **getAttribute**\<`T`\>(`key`): `T` \| `undefined`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:52](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L52)

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### incrementAttempt()

> **incrementAttempt**(): `void`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:40](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L40)

#### Returns

`void`

***

### reset()

> **reset**(): `void`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:61](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L61)

#### Returns

`void`

***

### setAttribute()

> **setAttribute**(`key`, `value`): `void`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:57](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L57)

#### Parameters

##### key

`string`

##### value

`unknown`

#### Returns

`void`

***

### setExhausted()

> **setExhausted**(): `void`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:48](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L48)

#### Returns

`void`

***

### setLastError()

> **setLastError**(`error`): `void`

Defined in: [packages/retry-core/src/libs/RetryContext.ts:44](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/retry-core/src/libs/RetryContext.ts#L44)

#### Parameters

##### error

`Error`

#### Returns

`void`
