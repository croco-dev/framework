---
editUrl: false
next: false
prev: false
title: "findRecoverMethod"
---

> **findRecoverMethod**(`target`, `error`): [`RecoverMetadata`](/api/retry-core/src/interfaces/recovermetadata/) \| `undefined`

Defined in: [packages/retry-core/src/libs/Recover.ts:63](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/retry-core/src/libs/Recover.ts#L63)

Find the best matching

## Parameters

### target

`object`

### error

`Error`

## Returns

[`RecoverMetadata`](/api/retry-core/src/interfaces/recovermetadata/) \| `undefined`

## Recover

method for an error.
Matches by exception type hierarchy (most specific first).
