---
editUrl: false
next: false
prev: false
title: "DrizzleExecutionStore"
---

실행 요청을 Drizzle 테이블에 저장하는 구현체입니다.

## Extends

- `ExecutionStore`

## Type Parameters

### TDb

`TDb` *extends* `ExecutionDb`

## Implements

- `ExecutionLogStore`

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

`ExecutionStore.constructor`

## Methods

### appendLog()

> **appendLog**(`id`, `entry`): `Promise`\<`Execution`\>

실행 로그를 원자적으로 추가합니다.

#### Parameters

##### id

`string`

##### entry

`ExecutionLogEntry`

#### Returns

`Promise`\<`Execution`\>

#### Implementation of

`ExecutionLogStore.appendLog`

***

### create()

> **create**(`params`): `Promise`\<`Execution`\>

새 실행을 생성합니다. idempotencyKey가 있으면 중복 생성을 방지합니다.

#### Parameters

##### params

`CreateExecutionParams`

#### Returns

`Promise`\<`Execution`\>

#### Overrides

`ExecutionStore.create`

***

### delete()

> **delete**(`id`): `Promise`\<`void`\>

실행을 삭제합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

`ExecutionStore.delete`

***

### findById()

> **findById**(`id`): `Promise`\<`Execution` \| `null`\>

실행 ID로 단일 실행을 조회합니다.

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`Execution` \| `null`\>

#### Overrides

`ExecutionStore.findById`

***

### findByIdempotencyKey()

> **findByIdempotencyKey**(`key`): `Promise`\<`Execution` \| `null`\>

idempotencyKey로 기존 실행을 조회합니다.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`Execution` \| `null`\>

#### Overrides

`ExecutionStore.findByIdempotencyKey`

***

### list()

> **list**(`options?`): `Promise`\<`Execution`[]\>

상태, 타입, 부모 실행 조건으로 실행 목록을 조회합니다.

#### Parameters

##### options?

`ListExecutionsOptions` = `{}`

#### Returns

`Promise`\<`Execution`[]\>

#### Overrides

`ExecutionStore.list`

***

### update()

> **update**(`id`, `data`): `Promise`\<`Execution`\>

실행 상태와 메타데이터를 부분 업데이트합니다.

#### Parameters

##### id

`string`

##### data

`Partial`\<`Execution`\>

#### Returns

`Promise`\<`Execution`\>

#### Overrides

`ExecutionStore.update`
