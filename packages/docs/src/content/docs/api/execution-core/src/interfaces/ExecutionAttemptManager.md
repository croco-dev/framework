---
editUrl: false
next: false
prev: false
title: "ExecutionAttemptManager"
---

Optional manager capability for attempt-fenced task mutations.

## Methods

### checkpointAttempt()

> **checkpointAttempt**(`token`, `key`, `value`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### key

`string`

##### value

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### completeAttempt()

> **completeAttempt**(`token`, `result?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### result?

`unknown`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### failAttempt()

> **failAttempt**(`token`, `error`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### error

[`ExecutionError`](/api/execution-core/src/interfaces/executionerror/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### recordLogAttempt()

> **recordLogAttempt**(`token`, `params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### params

[`AddExecutionLogParams`](/api/execution-core/src/interfaces/addexecutionlogparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### resolveIndeterminateTimeout()

> **resolveIndeterminateTimeout**(`token`, `reason`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### reason

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### settleTimedOutAttempt()

> **settleTimedOutAttempt**(`token`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### supportsAttemptFencing()

> **supportsAttemptFencing**(): `boolean`

Whether the configured persistence store can enforce atomic attempt fencing.

#### Returns

`boolean`

---

### timeoutAttempt()

> **timeoutAttempt**(`token`, `options`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### options

[`TimeoutExecutionAttemptOptions`](/api/execution-core/src/type-aliases/timeoutexecutionattemptoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### updateProgressAttempt()

> **updateProgressAttempt**(`token`, `progress`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### token

[`ExecutionAttemptToken`](/api/execution-core/src/type-aliases/executionattempttoken/)

##### progress

[`ProgressInfo`](/api/execution-core/src/interfaces/progressinfo/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>
