---
editUrl: false
next: false
prev: false
title: "normalizeZodQueryInput"
---

> **normalizeZodQueryInput**(`schema`, `source`): `object`

Normalize HTTP query cardinality without parsing domain values.

## Parameters

### schema

`ZodType`

### source

`Readonly`\<`Record`\<`string`, `unknown`\>\>

## Returns

`object`

### input

> **input**: `Record`\<`string`, `unknown`\>

### repeatedScalarFields

> **repeatedScalarFields**: `string`[]

### schema

> **schema**: `ZodType`
