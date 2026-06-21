---
editUrl: false
next: false
prev: false
title: "QStashTaskRunner"
---

QStash에 태스크 메시지를 발행하는 태스크 러너입니다.

## Constructors

### Constructor

> **new QStashTaskRunner**(`options`): `QStashTaskRunner`

#### Parameters

##### options

[`QStashTaskRunnerOptions`](/api/tasks-qstash/src/type-aliases/qstashtaskrunneroptions/)

#### Returns

`QStashTaskRunner`

## Methods

### execute()

> **execute**(`taskId`, `payload`, `options?`): `Promise`\<\{ `messageId`: `string`; \}\>

태스크 식별자와 페이로드를 QStash에 발행합니다.

#### Parameters

##### taskId

`string`

##### payload

`unknown`

##### options?

[`QStashTaskExecuteOptions`](/api/tasks-qstash/src/type-aliases/qstashtaskexecuteoptions/)

#### Returns

`Promise`\<\{ `messageId`: `string`; \}\>
