---
editUrl: false
next: false
prev: false
title: "ProblemFormModel"
---

> **ProblemFormModel**\<`Values`, `FieldName`\> = `object`

## Type Parameters

### Values

`Values` *extends* `Record`\<`string`, `unknown`\>

### FieldName

`FieldName` *extends* keyof `Values` & `string`

## Properties

### fieldNames

> `readonly` **fieldNames**: readonly `FieldName`[]

***

### fields

> `readonly` **fields**: readonly [`ProblemFormField`](/api/frontend-problems/src/type-aliases/problemformfield/)\<`Values`\[`FieldName`\]\>[]

***

### initialValues

> `readonly` **initialValues**: `Values`

***

### method

> `readonly` **method**: `string`

***

### methodName

> `readonly` **methodName**: `string`

***

### operationId

> `readonly` **operationId**: `string`

***

### path

> `readonly` **path**: `string`

***

### routeId

> `readonly` **routeId**: `string`
