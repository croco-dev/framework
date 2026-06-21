---
editUrl: false
next: false
prev: false
title: "OperationsTimelineEvent"
---

> **OperationsTimelineEvent**\<`TSource`, `TExtension`\> = `object`

## Type Parameters

### TSource

`TSource` *extends* [`OperationsTimelineSource`](/api/admin-ops/src/type-aliases/operationstimelinesource/) = [`OperationsTimelineSource`](/api/admin-ops/src/type-aliases/operationstimelinesource/)

### TExtension

`TExtension` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

## Properties

### actor?

> `readonly` `optional` **actor**: [`OperationsTimelineActor`](/api/admin-ops/src/type-aliases/operationstimelineactor/)

***

### correlationId?

> `readonly` `optional` **correlationId**: `string`

***

### customerId?

> `readonly` `optional` **customerId**: `string`

***

### entities

> `readonly` **entities**: readonly [`OperationsTimelineEntity`](/api/admin-ops/src/type-aliases/operationstimelineentity/)[]

***

### extension

> `readonly` **extension**: `Readonly`\<`TExtension` & `object`\>

***

### id

> `readonly` **id**: `string`

***

### primaryEntity?

> `readonly` `optional` **primaryEntity**: [`OperationsTimelineEntity`](/api/admin-ops/src/type-aliases/operationstimelineentity/)

***

### problem?

> `readonly` `optional` **problem**: [`OperationsTimelineProblem`](/api/admin-ops/src/type-aliases/operationstimelineproblem/)

***

### recoveryAction?

> `readonly` `optional` **recoveryAction**: `string`

***

### retry?

> `readonly` `optional` **retry**: [`OperationsTimelineRetry`](/api/admin-ops/src/type-aliases/operationstimelineretry/)

***

### severity

> `readonly` **severity**: [`OperationsTimelineSeverity`](/api/admin-ops/src/type-aliases/operationstimelineseverity/)

***

### source

> `readonly` **source**: `TSource`

***

### summary?

> `readonly` `optional` **summary**: `string`

***

### tenantId?

> `readonly` `optional` **tenantId**: `string`

***

### timestamp

> `readonly` **timestamp**: `Date`

***

### title

> `readonly` **title**: `string`
