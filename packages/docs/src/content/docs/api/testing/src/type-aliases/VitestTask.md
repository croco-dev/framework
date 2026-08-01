---
editUrl: false
next: false
prev: false
title: "VitestTask"
---

> **VitestTask** = `object`

## Properties

### diagnostic

> `readonly` **diagnostic**: () => \{ `duration`: `number`; `flaky`: `boolean`; `retryCount`: `number`; \} \| `undefined`

#### Returns

\{ `duration`: `number`; `flaky`: `boolean`; `retryCount`: `number`; \} \| `undefined`

***

### fullName

> `readonly` **fullName**: `string`

***

### id

> `readonly` **id**: `string`

***

### name

> `readonly` **name**: `string`

***

### result

> `readonly` **result**: () => `object`

#### Returns

`object`

##### errors?

> `readonly` `optional` **errors?**: readonly `unknown`[]

##### state

> `readonly` **state**: `"failed"` \| `"passed"` \| `"pending"` \| `"skipped"`
