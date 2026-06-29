---
editUrl: false
next: false
prev: false
title: "RetryConsoleItem"
---

> **RetryConsoleItem** = `object`

## Properties

### attempts

> `readonly` **attempts**: `object`

#### current

> `readonly` **current**: `number`

#### max?

> `readonly` `optional` **max?**: `number`

***

### correlationIds

> `readonly` **correlationIds**: [`RetryConsoleCorrelationIds`](/api/admin-ops/src/type-aliases/retryconsolecorrelationids/)

***

### details?

> `readonly` `optional` **details?**: `Record`\<`string`, `unknown`\>

***

### id

> `readonly` **id**: `string`

***

### problem?

> `readonly` `optional` **problem?**: [`RetryConsoleProblemMetadata`](/api/admin-ops/src/type-aliases/retryconsoleproblemmetadata/)

***

### recoveryActions

> `readonly` **recoveryActions**: readonly [`RetryConsoleRecoveryAction`](/api/admin-ops/src/type-aliases/retryconsolerecoveryaction/)[]

***

### retryable

> `readonly` **retryable**: `boolean`

***

### source

> `readonly` **source**: [`RetryConsoleSourceMetadata`](/api/admin-ops/src/type-aliases/retryconsolesourcemetadata/)

***

### state

> `readonly` **state**: [`RetryConsoleItemState`](/api/admin-ops/src/type-aliases/retryconsoleitemstate/)

***

### timestamps

> `readonly` **timestamps**: [`RetryConsoleTimestamps`](/api/admin-ops/src/type-aliases/retryconsoletimestamps/)

***

### title

> `readonly` **title**: `string`
