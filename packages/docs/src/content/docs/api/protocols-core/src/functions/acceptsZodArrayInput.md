---
editUrl: false
next: false
prev: false
title: "acceptsZodArrayInput"
---

> **acceptsZodArrayInput**(`schema`): `boolean`

Returns whether a parameter schema explicitly accepts array input.

Arrays, any, unknown, transparent wrappers and refinements around them, and
ordinary unions containing an array-capable option accept repeated values.
Value-changing effects remain opaque so coercion and preprocessing cannot
silently reinterpret repeated scalar parameters.

## Parameters

### schema

`unknown`

## Returns

`boolean`
