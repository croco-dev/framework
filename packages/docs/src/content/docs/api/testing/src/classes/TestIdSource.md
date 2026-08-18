---
editUrl: false
next: false
prev: false
title: "TestIdSource"
---

## Constructors

### Constructor

> **new TestIdSource**(`seed`): `TestIdSource`

#### Parameters

##### seed

`string`

#### Returns

`TestIdSource`

## Properties

### seed

> `readonly` **seed**: `string`

## Accessors

### random

#### Get Signature

> **get** **random**(): [`TestRandomSource`](/api/testing/src/classes/testrandomsource/)

##### Returns

[`TestRandomSource`](/api/testing/src/classes/testrandomsource/)

## Methods

### fork()

> **fork**(): `TestIdSource`

#### Returns

`TestIdSource`

---

### next()

> **next**(`prefix?`): `string`

#### Parameters

##### prefix?

`string` = `"test"`

#### Returns

`string`
