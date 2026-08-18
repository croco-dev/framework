---
editUrl: false
next: false
prev: false
title: "RetryContext"
---

Context object passed to retry operations and listeners.
Tracks retry state across attempts.

## Constructors

### Constructor

> **new RetryContext**(`methodName`, `args`, `maxAttempts`): `RetryContext`

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

---

### maxAttempts

> `readonly` **maxAttempts**: `number`

---

### methodName

> `readonly` **methodName**: `string`

## Accessors

### attempt

#### Get Signature

> **get** **attempt**(): `number`

##### Returns

`number`

---

### elapsedTimeMs

#### Get Signature

> **get** **elapsedTimeMs**(): `number`

##### Returns

`number`

---

### exhausted

#### Get Signature

> **get** **exhausted**(): `boolean`

##### Returns

`boolean`

---

### lastError

#### Get Signature

> **get** **lastError**(): `Error` \| `null`

##### Returns

`Error` \| `null`

---

### remainingAttempts

#### Get Signature

> **get** **remainingAttempts**(): `number`

##### Returns

`number`

## Methods

### getAttribute()

> **getAttribute**\<`T`\>(`key`): `T` \| `undefined`

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

---

### incrementAttempt()

> **incrementAttempt**(): `void`

#### Returns

`void`

---

### reset()

> **reset**(): `void`

#### Returns

`void`

---

### setAttribute()

> **setAttribute**(`key`, `value`): `void`

#### Parameters

##### key

`string`

##### value

`unknown`

#### Returns

`void`

---

### setExhausted()

> **setExhausted**(): `void`

#### Returns

`void`

---

### setLastError()

> **setLastError**(`error`): `void`

#### Parameters

##### error

`Error`

#### Returns

`void`
