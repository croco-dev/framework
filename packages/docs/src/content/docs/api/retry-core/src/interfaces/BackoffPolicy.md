---
editUrl: false
next: false
prev: false
title: "BackoffPolicy"
---

Backoff policy interface.

## Type Parameters

### T

`T` = `unknown`

Backoff 구현체의 추가 옵션 타입

## Properties

### options?

> `readonly` `optional` **options?**: `T`

Backoff 구현체의 추가 옵션 (구현체에 따라 다름)

## Methods

### getDelay()

> **getDelay**(`attempt`): `number`

Calculate delay for the given attempt (0-based)

#### Parameters

##### attempt

`number`

#### Returns

`number`

---

### reset()

> **reset**(): `void`

Reset internal state if any

#### Returns

`void`

---

### wait()

> **wait**(`attempt`): `Promise`\<`void`\>

Wait for the calculated delay

#### Parameters

##### attempt

`number`

#### Returns

`Promise`\<`void`\>
