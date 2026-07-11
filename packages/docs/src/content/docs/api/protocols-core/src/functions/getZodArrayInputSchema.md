---
editUrl: false
next: false
prev: false
title: "getZodArrayInputSchema"
---

> **getZodArrayInputSchema**(`schema`): `ZodType`\<`any`, `ZodTypeDef`, `any`\> \| `undefined`

Projects a parameter schema to the branches that preserve array input.

Scalar and value-changing union branches are removed so their coercion,
preprocessing, or catch behavior cannot consume repeated parameter values.
The projection is cached by source schema for request-path reuse.

## Parameters

### schema

`unknown`

## Returns

`ZodType`\<`any`, `ZodTypeDef`, `any`\> \| `undefined`
