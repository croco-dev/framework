---
editUrl: false
next: false
prev: false
title: "normalizeZodQueryInput"
---

> **normalizeZodQueryInput**\<`TSchema`\>(`schema`, `source`): `object`

Normalize HTTP query cardinality without parsing domain values.

## Type Parameters

### TSchema

`TSchema` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

## Parameters

### schema

`TSchema`

### source

`Readonly`\<`Record`\<`string`, `unknown`\>\>

## Returns

`object`

### input

> **input**: `Record`\<`string`, `unknown`\>

### repeatedScalarFields

> **repeatedScalarFields**: `string`[]

### schema

> **schema**: `TSchema`
