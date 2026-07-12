---
editUrl: false
next: false
prev: false
title: "isZodArraySchema"
---

> **isZodArraySchema**(`schema`): `boolean`

Returns whether a schema accepts an array without changing its input shape.

Optional, nullable, default, catch, branded, readonly, and refinement wrappers
preserve array input. Transform and preprocess effects remain opaque because
they may change the runtime value shape.

## Parameters

### schema

`unknown`

## Returns

`boolean`
