---
editUrl: false
next: false
prev: false
title: "DrizzleExecutionStore"
---

실행 요청을 Drizzle 테이블에 저장하는 구현체입니다.

## Extends

- [`ExecutionStore`](/api/execution-core/src/classes/executionstore/)

## Type Parameters

### TDb

`TDb` _extends_ `ExecutionDb`

## Implements

- [`ExecutionLogStore`](/api/execution-core/src/interfaces/executionlogstore/)
- [`ExecutionContinuationStore`](/api/execution-core/src/interfaces/executioncontinuationstore/)

## Constructors

### Constructor

> **new DrizzleExecutionStore**\<`TDb`\>(`db`): `DrizzleExecutionStore`\<`TDb`\>

Drizzle 클라이언트를 받아 실행 저장소를 초기화합니다.

#### Parameters

##### db

`TDb`

#### Returns

`DrizzleExecutionStore`\<`TDb`\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`constructor`](/api/execution-core/src/classes/executionstore/#constructor)

## Methods

### acquireContinuation()

> **acquireContinuation**(`id`, `input`): `Promise`\<[`AcquireExecutionContinuationResult`](/api/execution-core/src/type-aliases/acquireexecutioncontinuationresult/)\>

전달 토큰과 현재 continuation 상태를 비교해 실행 소유권을 원자적으로 획득합니다.

#### Parameters

##### id

`string`

##### input

[`AcquireExecutionContinuationInput`](/api/execution-core/src/interfaces/acquireexecutioncontinuationinput/)

#### Returns

`Promise`\<[`AcquireExecutionContinuationResult`](/api/execution-core/src/type-aliases/acquireexecutioncontinuationresult/)\>

#### Implementation of

[`ExecutionContinuationStore`](/api/execution-core/src/interfaces/executioncontinuationstore/).[`acquireContinuation`](/api/execution-core/src/interfaces/executioncontinuationstore/#acquirecontinuation)

---

### appendLog()

> **appendLog**(`id`, `entry`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

실행 로그를 원자적으로 추가합니다.

#### Parameters

##### id

`string`

##### entry

[`ExecutionLogEntry`](/api/execution-core/src/interfaces/executionlogentry/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Implementation of

[`ExecutionLogStore`](/api/execution-core/src/interfaces/executionlogstore/).[`appendLog`](/api/execution-core/src/interfaces/executionlogstore/#appendlog)

---

### create()

> **create**(`params`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

새 실행을 생성합니다. idempotencyKey가 있으면 중복 생성을 방지합니다.

#### Parameters

##### params

[`CreateExecutionRecordParams`](/api/execution-core/src/interfaces/createexecutionrecordparams/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`create`](/api/execution-core/src/classes/executionstore/#create)

---

### delete()

> **delete**(`id`): `Promise`\<`void`\>

실행을 삭제합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`delete`](/api/execution-core/src/classes/executionstore/#delete)

---

### findById()

> **findById**(`id`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

실행 ID로 단일 실행을 조회합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`findById`](/api/execution-core/src/classes/executionstore/#findbyid)

---

### findByIdempotencyKey()

> **findByIdempotencyKey**(`key`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

idempotencyKey로 기존 실행을 조회합니다.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`findByIdempotencyKey`](/api/execution-core/src/classes/executionstore/#findbyidempotencykey)

---

### list()

> **list**(`options?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

상태, 타입, 부모 실행 조건으로 실행 목록을 조회합니다.

#### Parameters

##### options?

[`ListExecutionsOptions`](/api/execution-core/src/interfaces/listexecutionsoptions/) = `{}`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`list`](/api/execution-core/src/classes/executionstore/#list)

---

### listRunning()

> **listRunning**(`options`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

실행 중 레코드를 ID 기준 키셋 순서로 조회합니다.

#### Parameters

##### options

[`ListRunningExecutionsOptions`](/api/execution-core/src/interfaces/listrunningexecutionsoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)[]\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`listRunning`](/api/execution-core/src/classes/executionstore/#listrunning)

---

### update()

> **update**(`id`, `data`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

실행 상태와 메타데이터를 부분 업데이트합니다.

#### Parameters

##### id

`string`

##### data

`Partial`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`update`](/api/execution-core/src/classes/executionstore/#update)

---

### updateClaimedContinuation()

> **updateClaimedContinuation**(`id`, `input`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

fencing token이 현재 claim과 일치할 때만 continuation 상태를 갱신합니다.

#### Parameters

##### id

`string`

##### input

[`UpdateClaimedExecutionContinuationInput`](/api/execution-core/src/interfaces/updateclaimedexecutioncontinuationinput/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Implementation of

[`ExecutionContinuationStore`](/api/execution-core/src/interfaces/executioncontinuationstore/).[`updateClaimedContinuation`](/api/execution-core/src/interfaces/executioncontinuationstore/#updateclaimedcontinuation)

---

### updateIfStatus()

> **updateIfStatus**(`id`, `expectedStatus`, `data`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

현재 상태가 예상 상태와 일치할 때만 실행을 원자적으로 업데이트합니다.

#### Parameters

##### id

`string`

##### expectedStatus

[`ExecutionStatus`](/api/execution-core/src/type-aliases/executionstatus/)

##### data

`Partial`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/) \| `null`\>

#### Overrides

[`ExecutionStore`](/api/execution-core/src/classes/executionstore/).[`updateIfStatus`](/api/execution-core/src/classes/executionstore/#updateifstatus)
