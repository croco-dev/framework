---
editUrl: false
next: false
prev: false
title: "unwrapZodParameterSchema"
---

> **unwrapZodParameterSchema**\<`TSchema`\>(`schema`): `TSchema`

Removes catch wrappers that parameter-schema consumers cannot interpret.

Transparent wrappers and ordinary union options are reconstructed only when
they contain a catch. Value-changing effects and discriminated unions remain opaque.

## Type Parameters

### TSchema

`TSchema` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\> \| `null` \| `undefined`

## Parameters

### schema

`TSchema`

## Returns

`TSchema`
