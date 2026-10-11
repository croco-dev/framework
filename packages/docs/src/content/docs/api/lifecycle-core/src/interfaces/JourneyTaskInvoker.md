---
editUrl: false
next: false
prev: false
title: "JourneyTaskInvoker"
---

The application supplies its existing TaskRunner/dispatcher invocation; this bridge owns no timer.

## Methods

### invoke()

> **invoke**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

###### episodeId

`string`

###### idempotencyKey

`string`

###### revision

`number`

###### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

###### taskId

`string`

#### Returns

`Promise`\<`void`\>
