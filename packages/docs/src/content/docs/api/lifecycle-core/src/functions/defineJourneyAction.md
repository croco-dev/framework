---
editUrl: false
next: false
prev: false
title: "defineJourneyAction"
---

> **defineJourneyAction**\<`Params`\>(`capability`, `parse`, `dispatch`): [`JourneyAction`](/api/lifecycle-core/src/type-aliases/journeyaction/)

## Type Parameters

### Params

`Params`

## Parameters

### capability

`string`

### parse

(`params`) => `Params`

### dispatch

(`context`, `params`, `intent`) => `Promise`\<`"indeterminate"` \| `"accepted"` \| `"rejected"`\>

## Returns

[`JourneyAction`](/api/lifecycle-core/src/type-aliases/journeyaction/)
