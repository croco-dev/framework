---
editUrl: false
next: false
prev: false
title: "ExecutionContinuationStore"
---

Optional store capability for atomic continuation acquisition and fenced mutation.

Implementations must perform both operations as compare-and-set writes. A claimed
update returns null when the execution is no longer running under the supplied fence.

## Methods

### acquireContinuation()

> **acquireContinuation**(`id`, `input`): `Promise`\<[`AcquireExecutionContinuationResult`](/api/execution-core/src/type-aliases/acquireexecutioncontinuationresult/)\>

#### Parameters

##### id

`string`

##### input

[`AcquireExecutionContinuationInput`](/api/execution-core/src/interfaces/acquireexecutioncontinuationinput/)

#### Returns

`Promise`\<[`AcquireExecutionContinuationResult`](/api/execution-core/src/type-aliases/acquireexecutioncontinuationresult/)\>

---

### updateClaimedContinuation()

> **updateClaimedContinuation**(`id`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Parameters

##### id

`string`

##### input

[`UpdateClaimedExecutionContinuationInput`](/api/execution-core/src/interfaces/updateclaimedexecutioncontinuationinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>
