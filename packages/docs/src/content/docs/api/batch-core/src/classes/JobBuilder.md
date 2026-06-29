---
editUrl: false
next: false
prev: false
title: "JobBuilder"
---

## Constructors

### Constructor

> **new JobBuilder**(`name`): `JobBuilder`

#### Parameters

##### name

`string`

#### Returns

`JobBuilder`

## Methods

### build()

> **build**(): [`Job`](/api/batch-core/src/interfaces/job/)

#### Returns

[`Job`](/api/batch-core/src/interfaces/job/)

***

### next()

> **next**(`step`): `this`

#### Parameters

##### step

[`Step`](/api/batch-core/src/classes/step/)\<`unknown`, `unknown`\>

#### Returns

`this`

***

### start()

> **start**(`step`): `this`

#### Parameters

##### step

[`Step`](/api/batch-core/src/classes/step/)\<`unknown`, `unknown`\>

#### Returns

`this`
