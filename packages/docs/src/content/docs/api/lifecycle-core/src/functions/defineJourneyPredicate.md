---
editUrl: false
next: false
prev: false
title: "defineJourneyPredicate"
---

> **defineJourneyPredicate**\<`Params`\>(`parse`, `evaluate`): [`JourneyPredicate`](/api/lifecycle-core/src/type-aliases/journeypredicate/)

Parse at the definition boundary and again at invocation to preserve typed application contracts.

## Type Parameters

### Params

`Params`

## Parameters

### parse

(`params`) => `Params`

### evaluate

(`context`, `params`) => `Promise`\<`boolean` \| `"unknown"`\>

## Returns

[`JourneyPredicate`](/api/lifecycle-core/src/type-aliases/journeypredicate/)
