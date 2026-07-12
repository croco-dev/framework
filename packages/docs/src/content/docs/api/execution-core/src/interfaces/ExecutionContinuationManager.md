---
editUrl: false
next: false
prev: false
title: "ExecutionContinuationManager"
---

Optional atomic continuation capabilities for execution managers.

## Methods

### claimContinuation()

> **claimContinuation**(`id`, `input`): `Promise`\<[`ClaimExecutionContinuationResult`](/api/execution-core/src/type-aliases/claimexecutioncontinuationresult/)\>

#### Parameters

##### id

`string`

##### input

[`ClaimExecutionContinuationInput`](/api/execution-core/src/interfaces/claimexecutioncontinuationinput/)

#### Returns

`Promise`\<[`ClaimExecutionContinuationResult`](/api/execution-core/src/type-aliases/claimexecutioncontinuationresult/)\>

***

### completeContinuation()

> **completeContinuation**(`id`, `claim`, `result?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### result?

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

***

### confirmContinuationPublication()

> **confirmContinuationPublication**(`id`, `claim`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

***

### failContinuation()

> **failContinuation**(`id`, `claim`, `error`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### error

[`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

***

### renewContinuationClaim()

> **renewContinuationClaim**(`id`, `claim`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### input

[`RenewExecutionContinuationInput`](/api/execution-core/src/interfaces/renewexecutioncontinuationinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

***

### stageContinuation()

> **stageContinuation**(`id`, `claim`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### id

`string`

##### claim

[`ExecutionContinuationClaim`](/api/execution-core/src/interfaces/executioncontinuationclaim/)

##### input

[`StageExecutionContinuationInput`](/api/execution-core/src/interfaces/stageexecutioncontinuationinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>
