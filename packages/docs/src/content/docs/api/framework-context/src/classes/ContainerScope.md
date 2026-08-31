---
editUrl: false
next: false
prev: false
title: "ContainerScope"
---

Owns an isolated DI runtime that can be entered across asynchronous bootstrap and request work.

## Implements

- `AsyncDisposable`

## Constructors

### Constructor

> **new ContainerScope**(): `ContainerScope`

#### Returns

`ContainerScope`

## Properties

### id

> `readonly` **id**: `string`

## Methods

### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AsyncDisposable.[asyncDispose]`

---

### \[dispose\]()

> **\[dispose\]**(): `void`

#### Returns

`void`

---

### dispose()

> **dispose**(): `void`

#### Returns

`void`

---

### run()

#### Call Signature

> **run**\<`T`\>(`fn`): `Promise`\<`T`\>

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `Promise`\<`T`\>

##### Returns

`Promise`\<`T`\>

#### Call Signature

> **run**\<`T`\>(`fn`): `T`

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `T`

##### Returns

`T`

---

### runWithRollback()

> **runWithRollback**\<`T`\>(`fn`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>
